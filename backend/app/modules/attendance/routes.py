from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.attendance.repos import AttendanceRepository
from app.modules.attendance.schemas import (
    AttendanceDashboard, CheckpointCreate, CheckpointOut, ScanRequest, ScanResponse,
    RollLookupRequest, RollLookupResponse, RollScanRequest,
)
from app.modules.attendance.services import AttendanceService
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.registration.repos import RegistrationRepository

# /attendance/scan — scanner-facing endpoint
router = APIRouter(prefix="/attendance", tags=["attendance"])

# /events/{id}/attendance/... and /events/{id}/checkpoints — event-management endpoints
events_router = APIRouter(tags=["attendance"])


def _svc(db: AsyncSession = Depends(get_db)) -> AttendanceService:
    return AttendanceService(AttendanceRepository(db), RegistrationRepository(db))


@router.post("/scan", response_model=ScanResponse)
async def scan(
    body: ScanRequest,
    svc: AttendanceService = Depends(_svc),
    scanner: User = Depends(get_current_user),
) -> ScanResponse:
    result = await svc.scan(body.qr_token, body.checkpoint_id, scanner)
    return ScanResponse(**result)


@router.post("/lookup-roll", response_model=RollLookupResponse)
async def lookup_roll(
    body: RollLookupRequest,
    svc: AttendanceService = Depends(_svc),
    scanner: User = Depends(get_current_user),
) -> RollLookupResponse:
    result = await svc.lookup_by_roll(body.roll_number, body.event_id)
    return RollLookupResponse(**result)


@router.post("/scan-by-roll", response_model=ScanResponse)
async def scan_by_roll(
    body: RollScanRequest,
    svc: AttendanceService = Depends(_svc),
    scanner: User = Depends(get_current_user),
) -> ScanResponse:
    result = await svc.scan_by_roll(body.roll_number, body.event_id, body.checkpoint_id, scanner)
    return ScanResponse(**result)


@events_router.get("/events/{event_id}/attendance", response_model=AttendanceDashboard)
async def dashboard(event_id: UUID, svc: AttendanceService = Depends(_svc)) -> AttendanceDashboard:
    data = await svc.get_dashboard(event_id)
    return AttendanceDashboard(**data)


@events_router.get("/events/{event_id}/attendance/present")
async def present_users(
    event_id: UUID,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[dict]:
    return await svc.list_present_users(event_id)


@events_router.get("/events/{event_id}/attendance/checkpoint/{cp_id}")
async def checkpoint_stats(
    event_id: UUID, cp_id: UUID, svc: AttendanceService = Depends(_svc)
) -> dict:
    return await svc.get_checkpoint_stats(event_id, cp_id)


@events_router.get("/events/{event_id}/attendance/export")
async def export_csv(event_id: UUID, svc: AttendanceService = Depends(_svc)) -> PlainTextResponse:
    csv_data = await svc.export_csv(event_id)
    return PlainTextResponse(csv_data, media_type="text/csv",
                              headers={"Content-Disposition": f"attachment; filename=attendance_{event_id}.csv"})


@events_router.get("/events/{event_id}/checkpoints", response_model=list[CheckpointOut])
async def list_checkpoints(
    event_id: UUID,
    svc: AttendanceService = Depends(_svc),
) -> list[CheckpointOut]:
    cps = await svc.repo.list_checkpoints(event_id)
    return [CheckpointOut.model_validate(cp) for cp in cps]


@events_router.post("/events/{event_id}/checkpoints", response_model=CheckpointOut, status_code=201)
async def create_checkpoint(
    event_id: UUID,
    body: CheckpointCreate,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> CheckpointOut:
    cp = await svc.create_checkpoint(event_id, body.name, body.description, body.order)
    return CheckpointOut.model_validate(cp)
