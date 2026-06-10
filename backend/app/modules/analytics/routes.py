from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
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


@router.get("/clubs/{club_id}")
async def club_analytics(
    club_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> dict:
    if actor.role not in (UserRole.SUPER_ADMIN, UserRole.CLUB_ADMIN):
        raise ForbiddenError("Club Admin+ required")
    repo = AnalyticsRepository(db)
    return await repo.club_analytics(club_id)


@router.get("/platform")
async def platform_analytics(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> dict:
    if actor.role != UserRole.SUPER_ADMIN:
        raise ForbiddenError("Super Admin required")
    repo = AnalyticsRepository(db)
    return await repo.platform_analytics()
