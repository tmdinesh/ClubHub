from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.announcements.repos import AnnouncementRepository
from app.modules.announcements.schemas import AnnouncementCreate, AnnouncementOut
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.notifications.repos import NotificationRepository
from app.modules.registration.repos import RegistrationRepository

router = APIRouter(tags=["announcements"])


@router.post("/events/{event_id}/announcements", response_model=AnnouncementOut, status_code=201)
async def create_announcement(
    event_id: UUID,
    body: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> AnnouncementOut:
    repo = AnnouncementRepository(db)
    ann = await repo.create(
        event_id=event_id,
        title=body.title,
        body=body.body,
        sent_by=actor.id,
        target_audience=body.target_audience,
        channels=body.channels,
        sent_at=datetime.now(timezone.utc),
    )

    if body.channels and "IN_APP" in body.channels:
        reg_repo = RegistrationRepository(db)
        notif_repo = NotificationRepository(db)
        participants = await reg_repo.list_confirmed_with_users(event_id)
        for p in participants:
            await notif_repo.create(
                user_id=UUID(p["user_id"]),
                type="ANNOUNCEMENT",
                title=body.title,
                body=body.body,
            )

    return AnnouncementOut.model_validate(ann)


@router.get("/events/{event_id}/announcements", response_model=list[AnnouncementOut])
async def list_announcements(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[AnnouncementOut]:
    repo = AnnouncementRepository(db)
    anns = await repo.list_by_event(event_id)
    return [AnnouncementOut.model_validate(a) for a in anns]
