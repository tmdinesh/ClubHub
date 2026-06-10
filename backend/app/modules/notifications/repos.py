from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification


class NotificationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_user(self, user_id: UUID, skip: int = 0, limit: int = 50) -> list[Notification]:
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def mark_read(self, notif_id: UUID, user_id: UUID) -> None:
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notif_id, Notification.user_id == user_id
            )
        )
        notif = result.scalar_one_or_none()
        if notif:
            notif.is_read = True
            await self.db.flush()

    async def mark_all_read(self, user_id: UUID) -> None:
        result = await self.db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        for notif in result.scalars().all():
            notif.is_read = True
        await self.db.flush()

    async def create(self, **kwargs) -> Notification:
        notif = Notification(**kwargs)
        self.db.add(notif)
        await self.db.flush()
        return notif
