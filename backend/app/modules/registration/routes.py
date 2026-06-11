from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.events.repos import EventRepository
from app.modules.notifications.repos import NotificationRepository
from app.modules.registration.repos import RegistrationRepository
from app.modules.registration.schemas import (
    QRResponse, RegistrationDetailOut, RegistrationOut, RegistrationWithEventOut,
)
from app.modules.registration.services import RegistrationService
from app.modules.teams.repos import TeamRepository
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError
from app.shared.exceptions import ForbiddenError

router = APIRouter(tags=["registration"])


def _svc(db: AsyncSession = Depends(get_db)) -> RegistrationService:
    return RegistrationService(
        RegistrationRepository(db),
        EventRepository(db),
        NotificationRepository(db),
        TeamRepository(db),
    )


def _require_club_admin(actor: User = Depends(get_current_user)) -> User:
    if actor.role not in (UserRole.CLUB_ADMIN, UserRole.SUPER_ADMIN):
        raise ForbiddenError("Club Admin required")
    return actor


@router.post("/events/{event_id}/register", response_model=RegistrationOut, status_code=201)
async def register(
    event_id: UUID,
    svc: RegistrationService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> RegistrationOut:
    non_student_roles = {UserRole.FACULTY_ADVISOR, UserRole.CLUB_ADMIN, UserRole.SUPER_ADMIN, UserRole.ATTENDANCE_TEAM}
    if actor.role in non_student_roles:
        raise ForbiddenError("Only students can register for events")
    reg = await svc.register(event_id, actor)
    return RegistrationOut.model_validate(reg)


@router.get("/events/{event_id}/registrations", response_model=list[RegistrationDetailOut])
async def list_event_registrations(
    event_id: UUID,
    svc: RegistrationService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[RegistrationDetailOut]:
    rows = await svc.list_by_event_enriched(event_id)
    return [RegistrationDetailOut(**r) for r in rows]


@router.get("/registrations/me", response_model=list[RegistrationWithEventOut])
async def my_registrations(
    svc: RegistrationService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[RegistrationWithEventOut]:
    rows = await svc.my_registrations_enriched(actor)
    return [RegistrationWithEventOut(**r) for r in rows]


@router.post("/registrations/{reg_id}/cancel", response_model=RegistrationOut)
async def cancel_registration(
    reg_id: UUID,
    svc: RegistrationService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> RegistrationOut:
    reg = await svc.cancel(reg_id, actor)
    return RegistrationOut.model_validate(reg)


@router.delete("/registrations/{reg_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, response_class=Response)
async def admin_delete_registration(
    reg_id: UUID,
    svc: RegistrationService = Depends(_svc),
    actor: User = Depends(_require_club_admin),
) -> Response:
    await svc.admin_delete(reg_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/registrations/{reg_id}/qr")
async def get_qr(
    reg_id: UUID,
    svc: RegistrationService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> FileResponse:
    path = await svc.get_qr_image_path(reg_id, actor)
    return FileResponse(path, media_type="image/png", filename=f"qr-{reg_id}.png")
