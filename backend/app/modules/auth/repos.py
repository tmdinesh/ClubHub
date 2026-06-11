from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.shared.enums import UserRole


def _roll_from_email(email: str) -> str | None:
    """Extract roll number from institutional email (e.g. 23z320@psgtech.ac.in → 23Z320)."""
    local = email.split("@")[0].upper()
    return local if re.match(r"^[0-9]{2}[A-Z][0-9A-Z]+$", local) else None


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_google_id(self, google_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.google_id == google_id))
        return result.scalar_one_or_none()

    async def upsert(
        self,
        google_id: str,
        email: str,
        name: str,
        avatar_url: str | None,
    ) -> tuple[User, bool]:
        """Return (user, created). If user exists update last_login; otherwise create."""
        user = await self.get_by_google_id(google_id)
        if user is None:
            # Fallback: user may have been created via dev_login with same email
            result = await self.db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

        created = False
        if user is None:
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                avatar_url=avatar_url,
                role=UserRole.PARTICIPANT,
                last_login=datetime.now(timezone.utc),
                roll_number=_roll_from_email(email),
            )
            self.db.add(user)
            await self.db.flush()
            created = True
        else:
            user.google_id = google_id
            user.name = name
            user.avatar_url = avatar_url
            user.last_login = datetime.now(timezone.utc)
            if not user.roll_number:
                user.roll_number = _roll_from_email(email)
            await self.db.flush()
        return user, created

    async def update_role(self, user_id: UUID, role: UserRole) -> None:
        await self.db.execute(
            update(User).where(User.id == user_id).values(role=role)
        )

    async def get_or_create_by_email(
        self, email: str, name: str, role: UserRole
    ) -> tuple[User, bool]:
        user = await self.get_by_email(email)
        if user is not None:
            user.last_login = datetime.now(timezone.utc)
            if not user.roll_number:
                user.roll_number = _roll_from_email(email)
            await self.db.flush()
            return user, False
        user = User(
            google_id=f"dev:{email}",
            email=email,
            name=name,
            avatar_url=None,
            role=role,
            last_login=datetime.now(timezone.utc),
            roll_number=_roll_from_email(email),
        )
        self.db.add(user)
        await self.db.flush()
        return user, True

    async def list_all(self, role_filter: UserRole | None = None) -> list[User]:
        q = select(User)
        if role_filter:
            q = q.where(User.role == role_filter)
        q = q.order_by(User.created_at.desc())
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def update_user(self, user_id: UUID, **kwargs) -> User | None:
        user = await self.get_by_id(user_id)
        if not user:
            return None
        for k, v in kwargs.items():
            setattr(user, k, v)
        await self.db.flush()
        return user

    async def provision(self, email: str, name: str, role: UserRole, club_id: UUID | None) -> User:
        """Create or update a user for admin provisioning. Sets role and club_id explicitly."""
        user = await self.get_by_email(email)
        if user is None:
            user = User(
                google_id=f"provisioned:{email}",
                email=email,
                name=name,
                avatar_url=None,
                role=role,
                club_id=club_id,
                last_login=None,
            )
            self.db.add(user)
        else:
            user.name = name
            user.role = role
            user.club_id = club_id
        await self.db.flush()
        return user
