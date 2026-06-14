from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import UUID, uuid4

import httpx
from jose import JWTError, jwt
import bcrypt as _bcrypt

from app.core.config import settings
from app.core.redis import get_redis_client
from app.modules.auth.models import User
from app.modules.auth.repos import UserRepository
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError, UnauthorizedError


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def _clean_google_name(raw: str) -> str:
    """Strip institutional prefixes like '23Z320 - ' from Google display names."""
    cleaned = re.sub(r"^[A-Z0-9]+\s*-\s*", "", raw.strip())
    return cleaned.strip() or raw.strip()


class AuthService:
    def __init__(self, repo: UserRepository) -> None:
        self.repo = repo

    def get_google_auth_url(self, state: str) -> str:
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{GOOGLE_AUTH_URL}?{query}"

    async def exchange_code(self, code: str) -> tuple[str, str]:
        """Exchange OAuth code for Google tokens; return (access_token, id_token)."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return data["access_token"], data.get("id_token", "")

    async def get_google_user_info(self, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            return resp.json()

    def _validate_domain(self, email: str) -> None:
        if not any(email.endswith(f"@{d}") for d in settings.ALLOWED_EMAIL_DOMAINS):
            raise ForbiddenError(
                f"Email domain not allowed. Must be one of: {', '.join(settings.ALLOWED_EMAIL_DOMAINS)}"
            )

    async def google_callback(self, code: str) -> tuple[User, str, str]:
        """Full OAuth callback: validate domain, upsert user, issue tokens."""
        access_token, _ = await self.exchange_code(code)
        info = await self.get_google_user_info(access_token)

        email: str = info["email"]
        self._validate_domain(email)

        user, _ = await self.repo.upsert(
            google_id=info["sub"],
            email=email,
            name=_clean_google_name(info.get("name", "")),
            avatar_url=info.get("picture"),
        )

        jwt_access = self._create_access_token(user)
        jwt_refresh = await self._create_refresh_token(user)
        return user, jwt_access, jwt_refresh

    def _create_access_token(self, user: User) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "exp": int(expire.timestamp()),
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    async def _create_refresh_token(self, user: User) -> str:
        jti = str(uuid4())
        expire_seconds = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        payload = {
            "sub": str(user.id),
            "jti": jti,
            "exp": int((datetime.now(timezone.utc) + timedelta(seconds=expire_seconds)).timestamp()),
        }
        token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        token_hash = sha256(token.encode()).hexdigest()
        redis = get_redis_client()
        await redis.setex(
            f"refresh:{user.id}:{jti}",
            expire_seconds,
            token_hash,
        )
        return token

    async def refresh_tokens(self, refresh_token: str) -> tuple[str, str]:
        try:
            payload = jwt.decode(
                refresh_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
            )
        except JWTError:
            raise UnauthorizedError("Invalid refresh token")

        user_id = payload.get("sub")
        jti = payload.get("jti")
        if not user_id or not jti:
            raise UnauthorizedError("Malformed refresh token")

        redis = get_redis_client()
        stored_hash = await redis.get(f"refresh:{user_id}:{jti}")
        if not stored_hash:
            raise UnauthorizedError("Refresh token expired or revoked")

        token_hash = sha256(refresh_token.encode()).hexdigest()
        if stored_hash != token_hash:
            raise UnauthorizedError("Refresh token mismatch")

        user = await self.repo.get_by_id(UUID(user_id))
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or inactive")

        # Rotate: revoke old, issue new
        await redis.delete(f"refresh:{user_id}:{jti}")
        new_access = self._create_access_token(user)
        new_refresh = await self._create_refresh_token(user)
        return new_access, new_refresh

    async def logout(self, refresh_token: str) -> None:
        try:
            payload = jwt.decode(
                refresh_token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_exp": False},
            )
            user_id = payload.get("sub")
            jti = payload.get("jti")
            if user_id and jti:
                redis = get_redis_client()
                await redis.delete(f"refresh:{user_id}:{jti}")
        except JWTError:
            pass  # best-effort; don't fail logout on bad token

    async def get_current_user_from_token(self, token: str) -> User:
        try:
            payload = jwt.decode(
                token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
            )
        except JWTError:
            raise UnauthorizedError("Invalid or expired token")

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Token missing subject")

        # Attendance-taker tokens: sub = credential ID, role embedded in payload.
        # Build a synthetic User rather than hitting the DB.
        if payload.get("role") == UserRole.ATTENDANCE_TEAM:
            from uuid import UUID as _UUID
            synthetic = User()
            synthetic.id = _UUID(user_id)
            synthetic.role = UserRole.ATTENDANCE_TEAM
            synthetic.email = f"att:{user_id}@attendance"
            synthetic.name = "Attendance Taker"
            synthetic.is_active = True
            synthetic.google_id = f"att:{user_id}"
            synthetic.club_id = None
            return synthetic

        user = await self.repo.get_by_id(UUID(user_id))
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or inactive")
        return user

    async def super_admin_login(self, email: str, password: str) -> tuple[str, str]:
        """Password-based login exclusively for the configured super-admin account."""
        configured_email = settings.SUPER_ADMIN_EMAIL
        configured_password = settings.SUPER_ADMIN_PASSWORD
        if not configured_email or not configured_password:
            raise ForbiddenError("Super admin credentials are not configured")
        if email != configured_email or not _verify_password(password, configured_password):
            raise ForbiddenError("Invalid credentials")
        user, _ = await self.repo.get_or_create_by_email(
            configured_email, "Super Admin", UserRole.SUPER_ADMIN
        )
        if user.role != UserRole.SUPER_ADMIN:
            user.role = UserRole.SUPER_ADMIN
            await self.repo.db.flush()
        access_token = self._create_access_token(user)
        refresh_token = await self._create_refresh_token(user)
        return access_token, refresh_token

    async def dev_login(self, email: str, name: str, role: UserRole) -> tuple[str, str]:
        """Dev-only: upsert a user by email and issue a real token pair. No OAuth required."""
        self._validate_domain(email)
        user, _ = await self.repo.get_or_create_by_email(email, name, role)
        access_token = self._create_access_token(user)
        refresh_token = await self._create_refresh_token(user)
        return access_token, refresh_token
