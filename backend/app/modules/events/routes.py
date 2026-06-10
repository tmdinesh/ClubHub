from __future__ import annotations

import re
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.analytics.repos import AnalyticsRepository
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.events.models import Club, Event
from app.modules.events.repos import EventRepository
from app.modules.events.schemas import (
    ClubCreate, ClubOut, EventCreate, EventOut, EventUpdate, OrganizerAssign, RejectBody,
)
from app.modules.events.services import EventService
from app.modules.notifications.repos import NotificationRepository
from app.modules.registration.repos import RegistrationRepository
from app.shared.enums import EventStatus, UserRole
from app.shared.exceptions import ForbiddenError

router = APIRouter(prefix="/events", tags=["events"])
clubs_router = APIRouter(prefix="/clubs", tags=["clubs"])


def _svc(db: AsyncSession = Depends(get_db)) -> EventService:
    return EventService(EventRepository(db))


def _event_out(event) -> EventOut:
    out = EventOut.model_validate(event)
    if event.organizer_club:
        out.club_name = event.organizer_club.name
    return out


@router.post("", response_model=EventOut, status_code=201)
async def create_event(
    body: EventCreate,
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> EventOut:
    event = await svc.create_event(body.model_dump(), actor)
    return _event_out(event)


@router.get("/assigned", response_model=list[EventOut])
async def list_assigned_events(
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[EventOut]:
    events = await svc.repo.list_assigned_events(actor.id)
    return [_event_out(e) for e in events]


@router.get("/faculty/mine", response_model=list[EventOut])
async def faculty_events(
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[EventOut]:
    """All events where the current user is the assigned faculty advisor."""
    if actor.role not in (UserRole.FACULTY_ADVISOR, UserRole.SUPER_ADMIN):
        raise ForbiddenError("Faculty Advisor required")
    events = await svc.repo.list_events_by_faculty(actor.id)
    return [_event_out(e) for e in events]


@router.get("", response_model=list[EventOut])
async def list_events(
    status: EventStatus | None = None,
    club_id: UUID | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 20,
    svc: EventService = Depends(_svc),
) -> list[EventOut]:
    events = await svc.list_events(status=status, club_id=club_id, category=category, skip=skip, limit=limit)
    return [_event_out(e) for e in events]


@router.get("/by-id/{event_id}", response_model=EventOut)
async def get_event_by_id(event_id: UUID, svc: EventService = Depends(_svc)) -> EventOut:
    event = await svc.get_event(event_id)
    return _event_out(event)


@router.get("/report/download")
async def download_club_report(
    start_date: date = Query(..., description="Report start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Report end date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> StreamingResponse:
    if actor.role not in (UserRole.CLUB_ADMIN, UserRole.SUPER_ADMIN):
        raise ForbiddenError("Club Admin required")
    if actor.club_id is None:
        raise ForbiddenError("No club assigned")

    from app.modules.events.report import generate_club_report

    club = (await db.execute(select(Club).where(Club.id == actor.club_id))).scalar_one_or_none()
    if club is None:
        raise ForbiddenError("Club not found")

    start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
    end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)

    q = (
        select(Event)
        .where(
            Event.organizer_club_id == actor.club_id,
            Event.is_deleted == False,
            Event.start_datetime >= start_dt,
            Event.start_datetime <= end_dt,
        )
        .order_by(Event.start_datetime)
    )
    events = list((await db.execute(q)).scalars().all())

    analytics_repo = AnalyticsRepository(db)
    events_data = []
    for ev in events:
        stats: dict = {}
        try:
            async with db.begin_nested():
                stats = await analytics_repo.event_analytics(ev.id)
        except Exception:
            pass
        events_data.append({
            "title": ev.title,
            "description": ev.description,
            "agenda": ev.agenda,
            "venue": ev.venue,
            "category": ev.category,
            "event_type": ev.event_type.value if hasattr(ev.event_type, "value") else ev.event_type,
            "status": ev.status.value if hasattr(ev.status, "value") else ev.status,
            "start_datetime": ev.start_datetime,
            "end_datetime": ev.end_datetime,
            "max_participants": ev.max_participants,
            "is_team_event": ev.is_team_event,
            "team_min_size": ev.team_min_size,
            "team_max_size": ev.team_max_size,
            "total_registrations": stats.get("registrations", {}).get("total", 0),
            "confirmed_registrations": stats.get("registrations", {}).get("confirmed", 0),
            "attendance_present": stats.get("attendance", {}).get("present", 0),
            "total_teams": stats.get("teams", {}).get("total", 0),
            "avg_team_size": stats.get("teams", {}).get("avg_size", 0),
            "budget": stats.get("finance", {}).get("budget", 0),
            "spent": stats.get("finance", {}).get("spent", 0),
            "nps": stats.get("feedback", {}).get("nps"),
        })

    doc_bytes = generate_club_report(
        club_name=club.name,
        department=club.department,
        start_date=start_date,
        end_date=end_date,
        events=events_data,
    )

    safe_name = re.sub(r"[^\w\-]", "_", club.name)
    filename = f"{safe_name}_Report_{start_date}_{end_date}.docx"

    return StreamingResponse(
        iter([doc_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{slug}", response_model=EventOut)
async def get_event(slug: str, svc: EventService = Depends(_svc)) -> EventOut:
    event = await svc.get_event_by_slug(slug)
    return _event_out(event)


@router.patch("/{event_id}/submit-for-review", response_model=EventOut)
async def submit_for_review(
    event_id: UUID,
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> EventOut:
    event = await svc.submit_for_review(event_id, actor)
    return _event_out(event)


@router.post("/{event_id}/approve", response_model=EventOut)
async def approve_event(
    event_id: UUID,
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> EventOut:
    event = await svc.approve_event(event_id, actor)
    return _event_out(event)


@router.post("/{event_id}/reject", response_model=EventOut)
async def reject_event(
    event_id: UUID,
    body: RejectBody,
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> EventOut:
    event = await svc.reject_event(event_id, body.comment, actor)
    return _event_out(event)


@router.patch("/{event_id}", response_model=EventOut)
async def update_event(
    event_id: UUID,
    body: EventUpdate,
    svc: EventService = Depends(_svc),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> EventOut:
    reg_repo = RegistrationRepository(db)
    notif_repo = NotificationRepository(db)
    event = await svc.update_event(
        event_id, body.model_dump(exclude_none=True), actor, reg_repo, notif_repo
    )
    return _event_out(event)


@router.post("/{event_id}/cancel", response_model=EventOut)
async def cancel_event(
    event_id: UUID,
    svc: EventService = Depends(_svc),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> EventOut:
    reg_repo = RegistrationRepository(db)
    notif_repo = NotificationRepository(db)
    event = await svc.cancel_event(event_id, actor, reg_repo, notif_repo)
    return _event_out(event)


@router.delete("/{event_id}", status_code=204, response_class=Response, response_model=None)
async def delete_event(
    event_id: UUID,
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> None:
    await svc.delete_event(event_id, actor)


@router.post("/{event_id}/organizers", response_model=dict, status_code=201)
async def assign_organizer(
    event_id: UUID,
    body: OrganizerAssign,
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    organizer = await svc.assign_organizer(event_id, body.user_id, body.role, body.permissions, actor)
    return {"id": str(organizer.id), "event_id": str(organizer.event_id), "role": organizer.role}


# ── Clubs ─────────────────────────────────────────────────────────────────────

@clubs_router.post("", response_model=ClubOut, status_code=201)
async def create_club(
    body: ClubCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ClubOut:
    repo = EventRepository(db)
    club = await repo.create_club(**body.model_dump())
    return ClubOut.model_validate(club)


@clubs_router.get("", response_model=list[ClubOut])
async def list_clubs(db: AsyncSession = Depends(get_db)) -> list[ClubOut]:
    repo = EventRepository(db)
    clubs = await repo.list_clubs()
    return [ClubOut.model_validate(c) for c in clubs]
