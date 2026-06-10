from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.announcements.models import Announcement


class AnnouncementRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> Announcement:
        ann = Announcement(**kwargs)
        self.db.add(ann)
        await self.db.flush()
        return ann

    async def list_by_event(self, event_id: UUID) -> list[Announcement]:
        result = await self.db.execute(
            select(Announcement)
            .where(Announcement.event_id == event_id)
            .order_by(Announcement.sent_at.desc())
        )
        return list(result.scalars().all())
