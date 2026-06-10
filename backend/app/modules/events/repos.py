from __future__ import annotations

import re
import uuid
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.events.models import Club, Event, EventOrganizer, FacultyApproval
from app.shared.enums import ApprovalStatus, EventStatus


def _with_club(q):
    return q.options(selectinload(Event.organizer_club))


class EventRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_event(self, event_id: UUID) -> Event | None:
        result = await self.db.execute(
            _with_club(select(Event).where(Event.id == event_id, Event.is_deleted == False))
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Event | None:
        result = await self.db.execute(
            _with_club(select(Event).where(Event.slug == slug, Event.is_deleted == False))
        )
        return result.scalar_one_or_none()

    async def list_assigned_events(self, user_id: UUID) -> list[Event]:
        q = _with_club(
            select(Event)
            .join(EventOrganizer, EventOrganizer.event_id == Event.id)
            .where(EventOrganizer.user_id == user_id, Event.is_deleted == False)
            .order_by(Event.start_datetime.desc())
        )
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def list_events(
        self,
        status: EventStatus | None = None,
        club_id: UUID | None = None,
        category: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Event]:
        q = _with_club(select(Event).where(Event.is_deleted == False))
        if status:
            q = q.where(Event.status == status)
        if club_id:
            q = q.where(Event.organizer_club_id == club_id)
        if category:
            q = q.where(Event.category == category)
        q = q.offset(skip).limit(limit).order_by(Event.start_datetime.desc())
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create(self, **kwargs) -> Event:
        event = Event(**kwargs)
        self.db.add(event)
        await self.db.flush()
        # Reload with club relationship so callers can access event.organizer_club
        return await self.get_event(event.id)

    async def update(self, event: Event, **kwargs) -> Event:
        for k, v in kwargs.items():
            setattr(event, k, v)
        await self.db.flush()
        # Reload with club relationship
        return await self.get_event(event.id)

    async def soft_delete(self, event: Event) -> None:
        event.is_deleted = True
        await self.db.flush()

    async def slug_exists(self, slug: str) -> bool:
        result = await self.db.execute(select(Event.id).where(Event.slug == slug))
        return result.scalar_one_or_none() is not None

    async def add_organizer(
        self, event_id: UUID, user_id: UUID, role: str, permissions: dict | None
    ) -> EventOrganizer:
        organizer = EventOrganizer(
            event_id=event_id, user_id=user_id, role=role, permissions=permissions
        )
        self.db.add(organizer)
        await self.db.flush()
        return organizer

    async def create_approval(self, event_id: UUID, faculty_id: UUID) -> FacultyApproval:
        approval = FacultyApproval(event_id=event_id, faculty_id=faculty_id)
        self.db.add(approval)
        await self.db.flush()
        return approval

    async def get_pending_approval(self, event_id: UUID) -> FacultyApproval | None:
        result = await self.db.execute(
            select(FacultyApproval).where(
                FacultyApproval.event_id == event_id,
                FacultyApproval.status == ApprovalStatus.PENDING,
            )
        )
        return result.scalar_one_or_none()

    async def get_club(self, club_id: UUID) -> Club | None:
        result = await self.db.execute(select(Club).where(Club.id == club_id))
        return result.scalar_one_or_none()

    async def list_clubs(self) -> list[Club]:
        result = await self.db.execute(select(Club).where(Club.is_active == True))
        return list(result.scalars().all())

    async def list_events_by_faculty(self, faculty_id: UUID) -> list[Event]:
        """Events where this user is the faculty advisor — either set directly on the
        event or via the club's current faculty_advisor_id."""
        club_ids_subq = select(Club.id).where(Club.faculty_advisor_id == faculty_id)
        q = _with_club(
            select(Event)
            .where(
                Event.is_deleted == False,
                or_(
                    Event.faculty_advisor_id == faculty_id,
                    Event.organizer_club_id.in_(club_ids_subq),
                ),
            )
            .order_by(Event.start_datetime.desc())
        )
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create_club(self, **kwargs) -> Club:
        club = Club(**kwargs)
        self.db.add(club)
        await self.db.flush()
        return club

    async def update_club(self, club_id: UUID, **kwargs) -> Club | None:
        club = await self.get_club(club_id)
        if not club:
            return None
        for k, v in kwargs.items():
            setattr(club, k, v)
        await self.db.flush()
        return club
