from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.notifications.repos import NotificationRepository
from app.modules.notifications.schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> list[NotificationOut]:
    repo = NotificationRepository(db)
    notifs = await repo.list_for_user(actor.id, skip, limit)
    return [NotificationOut.model_validate(n) for n in notifs]


@router.patch("/read-all", status_code=204, response_class=Response, response_model=None)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> None:
    repo = NotificationRepository(db)
    await repo.mark_all_read(actor.id)


@router.patch("/{notif_id}/read", status_code=204, response_class=Response, response_model=None)
async def mark_read(
    notif_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> None:
    repo = NotificationRepository(db)
    await repo.mark_read(notif_id, actor.id)
