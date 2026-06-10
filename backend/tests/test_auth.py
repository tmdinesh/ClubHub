"""Unit tests for auth module."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from jose import jwt

from app.core.config import settings
from app.modules.auth.models import User
from app.modules.auth.repos import UserRepository
from app.modules.auth.services import AuthService
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError, UnauthorizedError


def _make_user(role: UserRole = UserRole.PARTICIPANT) -> User:
    u = User()
    u.id = uuid4()
    u.google_id = "google_123"
    u.email = f"test@{settings.ALLOWED_EMAIL_DOMAINS[0]}"
    u.name = "Test User"
    u.role = role
    u.is_active = True
    u.last_login = None
    u.avatar_url = None
    return u


class TestDomainValidation:
    def test_allowed_domain_passes(self):
        repo = MagicMock(spec=UserRepository)
        svc = AuthService(repo)
        svc._validate_domain(f"student@{settings.ALLOWED_EMAIL_DOMAINS[0]}")  # should not raise

    def test_blocked_domain_raises(self):
        repo = MagicMock(spec=UserRepository)
        svc = AuthService(repo)
        with pytest.raises(ForbiddenError):
            svc._validate_domain("student@gmail.com")

    def test_empty_domain_raises(self):
        repo = MagicMock(spec=UserRepository)
        svc = AuthService(repo)
        with pytest.raises(ForbiddenError):
            svc._validate_domain("student@notallowed.com")


class TestTokenCreation:
    def test_access_token_contains_sub_and_role(self):
        repo = MagicMock(spec=UserRepository)
        svc = AuthService(repo)
        user = _make_user()
        token = svc._create_access_token(user)
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert payload["sub"] == str(user.id)
        assert payload["role"] == user.role
        assert "exp" in payload

    def test_access_token_expires_correctly(self):
        repo = MagicMock(spec=UserRepository)
        svc = AuthService(repo)
        user = _make_user()
        token = svc._create_access_token(user)
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        expected_exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        # within 5 seconds of expected
        assert abs(payload["exp"] - expected_exp.timestamp()) < 5


class TestRefreshTokenFlow:
    @pytest.mark.asyncio
    async def test_refresh_token_stored_in_redis(self):
        repo = MagicMock(spec=UserRepository)
        svc = AuthService(repo)
        user = _make_user()

        with patch("app.modules.auth.services.get_redis_client") as mock_redis_factory:
            mock_redis = AsyncMock()
            mock_redis.setex = AsyncMock(return_value=True)
            mock_redis_factory.return_value = mock_redis

            token = await svc._create_refresh_token(user)

        assert token
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        key = call_args[0][0]
        assert key.startswith(f"refresh:{user.id}:")

    @pytest.mark.asyncio
    async def test_expired_refresh_token_raises(self):
        repo = MagicMock(spec=UserRepository)
        svc = AuthService(repo)

        # Create an expired token
        payload = {
            "sub": str(uuid4()),
            "jti": str(uuid4()),
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        }
        expired_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

        with pytest.raises(UnauthorizedError):
            await svc.refresh_tokens(expired_token)

    @pytest.mark.asyncio
    async def test_refresh_token_not_in_redis_raises(self):
        repo = MagicMock(spec=UserRepository)
        svc = AuthService(repo)
        user = _make_user()

        jti = str(uuid4())
        payload = {
            "sub": str(user.id),
            "jti": jti,
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
        }
        token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

        with patch("app.modules.auth.services.get_redis_client") as mock_redis_factory:
            mock_redis = AsyncMock()
            mock_redis.get = AsyncMock(return_value=None)  # not in Redis
            mock_redis_factory.return_value = mock_redis

            with pytest.raises(UnauthorizedError, match="expired or revoked"):
                await svc.refresh_tokens(token)


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_invalid_token_raises(self):
        repo = AsyncMock(spec=UserRepository)
        svc = AuthService(repo)
        with pytest.raises(UnauthorizedError):
            await svc.get_current_user_from_token("invalid.token.here")

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self):
        repo = AsyncMock(spec=UserRepository)
        user = _make_user()
        repo.get_by_id = AsyncMock(return_value=user)

        svc = AuthService(repo)
        token = svc._create_access_token(user)
        result = await svc.get_current_user_from_token(token)
        assert result.id == user.id

    @pytest.mark.asyncio
    async def test_inactive_user_raises(self):
        repo = AsyncMock(spec=UserRepository)
        user = _make_user()
        user.is_active = False
        repo.get_by_id = AsyncMock(return_value=user)

        svc = AuthService(repo)
        token = svc._create_access_token(user)
        with pytest.raises(UnauthorizedError):
            await svc.get_current_user_from_token(token)
