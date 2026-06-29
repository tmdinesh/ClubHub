from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.email import send_event_update_email
from app.modules.announcements.repos import AnnouncementRepository
from app.modules.announcements.schemas import AnnouncementCreate, AnnouncementOut
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.events.repos import EventRepository
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

    if body.channels and ("IN_APP" in body.channels or "EMAIL" in body.channels):
        reg_repo = RegistrationRepository(db)
        participants = await reg_repo.list_confirmed_with_users(event_id)

        if "IN_APP" in body.channels:
            notif_repo = NotificationRepository(db)
            for p in participants:
                await notif_repo.create(
                    user_id=UUID(p["user_id"]),
                    type="ANNOUNCEMENT",
                    title=body.title,
                    body=body.body,
                )

        if "EMAIL" in body.channels:
            event_repo = EventRepository(db)
            event = await event_repo.get_event(event_id)
            club_name = event.organizer_club.name if event and event.organizer_club else "ClubHub"
            event_title = event.title if event else ""
            for p in participants:
                await send_event_update_email(
                    recipient_email=p["email"],
                    recipient_name=p["name"],
                    event_title=event_title,
                    club_name=club_name,
                    message_body=body.body,
                    subject_prefix=body.title,
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
