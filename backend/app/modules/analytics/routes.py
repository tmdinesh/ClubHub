from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.analytics.repos import AnalyticsRepository
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/events/{event_id}")
async def event_analytics(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> dict:
    allowed = {UserRole.SUPER_ADMIN, UserRole.CLUB_ADMIN, UserRole.EVENT_HEAD, UserRole.FACULTY_ADVISOR}
    if actor.role not in allowed:
        raise ForbiddenError("Insufficient role for event analytics")
    repo = AnalyticsRepository(db)
    return await repo.event_analytics(event_id)


@router.get("/clubs")
async def all_clubs_analytics(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> list[dict]:
    if actor.role != UserRole.SUPER_ADMIN:
        raise ForbiddenError("Super Admin required")
    repo = AnalyticsRepository(db)
    return await repo.all_clubs_analytics()


@router.get("/clubs/{club_id}")
async def club_analytics(
    club_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> dict:
    if actor.role == UserRole.FACULTY_ADVISOR:
        # Faculty advisors can only see their own club
        from app.modules.events.models import Club
        from sqlalchemy import select as sa_select
        club = (await db.execute(sa_select(Club).where(Club.faculty_advisor_id == actor.id))).scalar_one_or_none()
        if not club or club.id != club_id:
            raise ForbiddenError("You can only view analytics for your own club")
    elif actor.role not in (UserRole.SUPER_ADMIN, UserRole.CLUB_ADMIN):
        raise ForbiddenError("Club Admin+ required")
    repo = AnalyticsRepository(db)
    return await repo.club_analytics(club_id)


@router.get("/my-club")
async def my_club_analytics(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> dict:
    """Faculty advisor or club admin fetches analytics for their own club."""
    from app.modules.events.models import Club
    from sqlalchemy import select as sa_select

    if actor.role == UserRole.FACULTY_ADVISOR:
        club = (await db.execute(sa_select(Club).where(Club.faculty_advisor_id == actor.id))).scalar_one_or_none()
    elif actor.role == UserRole.CLUB_ADMIN:
        club = (await db.execute(sa_select(Club).where(Club.id == actor.club_id))).scalar_one_or_none()
    else:
        raise ForbiddenError("Club Admin or Faculty Advisor required")

    if not club:
        raise ForbiddenError("No club associated with your account")

    repo = AnalyticsRepository(db)
    data = await repo.club_analytics(club.id)
    data["club_name"] = club.name
    return data


@router.get("/platform")
async def platform_analytics(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> dict:
    if actor.role != UserRole.SUPER_ADMIN:
        raise ForbiddenError("Super Admin required")
    repo = AnalyticsRepository(db)
    return await repo.platform_analytics()


@router.get("/bank-export", response_class=PlainTextResponse)
async def bank_export(
    from_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> PlainTextResponse:
    if actor.role != UserRole.SUPER_ADMIN:
        raise ForbiddenError("Super Admin required")
    repo = AnalyticsRepository(db)
    csv_data = await repo.winners_bank_export(from_date, to_date)
    filename = f"bank-details-{from_date}-to-{to_date}.csv"
    return PlainTextResponse(
        csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/bank-details")
async def bank_details(
    from_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> list[dict]:
    if actor.role != UserRole.SUPER_ADMIN:
        raise ForbiddenError("Super Admin required")
    repo = AnalyticsRepository(db)
    return await repo.winners_bank_list(from_date, to_date)


@router.get("/my-club/bank-export", response_class=PlainTextResponse)
async def my_club_bank_export(
    from_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> PlainTextResponse:
    from app.modules.events.models import Club
    from sqlalchemy import select as sa_select

    if actor.role == UserRole.FACULTY_ADVISOR:
        club = (await db.execute(sa_select(Club).where(Club.faculty_advisor_id == actor.id))).scalar_one_or_none()
    elif actor.role == UserRole.CLUB_ADMIN:
        club = (await db.execute(sa_select(Club).where(Club.id == actor.club_id))).scalar_one_or_none()
    else:
        raise ForbiddenError("Club Admin or Faculty Advisor required")

    if not club:
        raise ForbiddenError("No club associated with your account")

    repo = AnalyticsRepository(db)
    csv_data = await repo.winners_bank_export_by_club(club.id, from_date, to_date)
    filename = f"bank-details-{club.name.replace(' ', '_')}-{from_date}-to-{to_date}.csv"
    return PlainTextResponse(
        csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/my-club/bank-details")
async def my_club_bank_details(
    from_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> list[dict]:
    from app.modules.events.models import Club
    from sqlalchemy import select as sa_select

    if actor.role == UserRole.FACULTY_ADVISOR:
        club = (await db.execute(sa_select(Club).where(Club.faculty_advisor_id == actor.id))).scalar_one_or_none()
    elif actor.role == UserRole.CLUB_ADMIN:
        club = (await db.execute(sa_select(Club).where(Club.id == actor.club_id))).scalar_one_or_none()
    else:
        raise ForbiddenError("Club Admin or Faculty Advisor required")

    if not club:
        raise ForbiddenError("No club associated with your account")

    repo = AnalyticsRepository(db)
    return await repo.winners_bank_list_by_club(club.id, from_date, to_date)
