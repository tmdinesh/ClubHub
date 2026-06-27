from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.shared.enums import UserRole

_INACTIVITY_YEARS = 6


async def delete_inactive_users(db: AsyncSession) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=_INACTIVITY_YEARS * 365)
    result = await db.execute(
        select(User).where(
            User.role == UserRole.PARTICIPANT,
            or_(
                and_(User.last_login.is_(None), User.created_at < cutoff),
                User.last_login < cutoff,
            ),
        )
    )
    users = result.scalars().all()
    for u in users:
        await db.delete(u)
    await db.commit()
    return len(users)
