from __future__ import annotations

import json
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.modules.attendance.repos import AttendanceRepository
from app.modules.attendance.services import AttendanceService
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.certificates.repos import CertificateRepository
from app.modules.certificates.schemas import (
    BulkGenerateRequest, CertificateOut, VerifyResponse,
)
from app.modules.certificates.services import CertificateService
from app.modules.events.repos import EventRepository
from app.modules.notifications.repos import NotificationRepository
from app.modules.registration.repos import RegistrationRepository
from app.shared.enums import CertificateType, UserRole
from app.shared.exceptions import ForbiddenError

router = APIRouter(tags=["certificates"])
public_router = APIRouter(tags=["certificates-verify"])


def _svc(db: AsyncSession = Depends(get_db)) -> CertificateService:
    return CertificateService(CertificateRepository(db))


def _att_svc(db: AsyncSession = Depends(get_db)) -> AttendanceService:
    return AttendanceService(AttendanceRepository(db), RegistrationRepository(db))


def _require_club_admin(actor: User = Depends(get_current_user)) -> User:
    if actor.role not in (UserRole.CLUB_ADMIN, UserRole.SUPER_ADMIN):
        raise ForbiddenError("Club Admin required")
    return actor


def _cert_out(cert, recipient_name: str = "") -> CertificateOut:
    out = CertificateOut.model_validate(cert)
    if cert.event:
        out.event_title = cert.event.title
    if recipient_name:
        out.recipient_name = recipient_name
    return out


# ── Schemas for smart generation ─────────────────────────────────────────────

class WinnerEntry(BaseModel):
    user_id: str
    name: str
    position: str  # "1st" | "2nd" | "3rd" | "4th"
    prize_amount: float | None = None
    bank_account: str | None = None
    bank_name: str | None = None
    ifsc: str | None = None
    upi: str | None = None


class GenerateWinnersRequest(BaseModel):
    winners: list[WinnerEntry]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/events/{event_id}/certificate-templates")
async def list_templates(
    event_id: UUID,
    svc: CertificateService = Depends(_svc),
    actor: User = Depends(_require_club_admin),
) -> list[dict]:
    templates = await svc.repo.list_templates_by_event(event_id)
    return [
        {"id": str(t.id), "type": t.certificate_type, "template_file_url": t.template_file_url, "placeholders": t.placeholders}
        for t in templates
    ]


@router.get("/events/{event_id}/certificates", response_model=list[CertificateOut])
async def list_event_certificates(
    event_id: UUID,
    svc: CertificateService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[CertificateOut]:
    rows = await svc.repo.list_by_event_enriched(event_id)
    return [_cert_out(cert, name) for cert, name in rows]


@router.post("/events/{event_id}/certificate-templates", status_code=201)
async def upload_template(
    event_id: UUID,
    certificate_type: str = Form(...),
    placeholders: str = Form("{}"),
    file: UploadFile = File(...),
    svc: CertificateService = Depends(_svc),
    actor: User = Depends(_require_club_admin),
) -> dict:
    data = await file.read()
    ext = Path(file.filename or "template.png").suffix.lower() or ".png"
    filename = f"tmpl_{uuid.uuid4().hex}{ext}"
    templates_dir = Path(settings.LOCAL_STORAGE_PATH) / "templates"
    templates_dir.mkdir(parents=True, exist_ok=True)
    (templates_dir / filename).write_bytes(data)
    file_url = f"/media/templates/{filename}"
    try:
        ph = json.loads(placeholders)
    except Exception:
        ph = {}
    cert_type = CertificateType(certificate_type)
    t = await svc.upload_template(event_id, cert_type, file_url, ph)
    return {"id": str(t.id), "event_id": str(t.event_id), "type": t.certificate_type, "template_file_url": file_url, "placeholders": ph}


@router.post("/events/{event_id}/certificates/generate", response_model=list[CertificateOut], status_code=201)
async def bulk_generate(
    event_id: UUID,
    body: BulkGenerateRequest,
    svc: CertificateService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[CertificateOut]:
    certs = await svc.bulk_generate(event_id, body.template_id, body.recipients)
    return [_cert_out(c) for c in certs]


@router.post("/events/{event_id}/certificates/generate-participation",
             response_model=list[CertificateOut], status_code=201)
async def generate_participation(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    svc: CertificateService = Depends(_svc),
    att_svc: AttendanceService = Depends(_att_svc),
    event_repo: EventRepository = Depends(lambda db=Depends(get_db): EventRepository(db)),
    actor: User = Depends(_require_club_admin),
) -> list[CertificateOut]:
    event = await event_repo.get_event(event_id)
    present = await att_svc.list_present_users(event_id)
    club_name = event.organizer_club.name if event and event.organizer_club else ""
    event_name = event.title if event else str(event_id)
    certs = await svc.generate_participation(event_id, event_name, club_name, present)
    # Notify each recipient
    notif_repo = NotificationRepository(db)
    for cert in certs:
        await notif_repo.create(
            user_id=cert.recipient_id,
            type="CERTIFICATE_ISSUED",
            title=f"Certificate issued: {event_name}",
            body="Your participation certificate has been issued. View it in your dashboard.",
            metadata_={"event_id": str(event_id), "cert_id": str(cert.id)},
        )
    return [_cert_out(c) for c in certs]


@router.post("/events/{event_id}/certificates/generate-winners",
             response_model=list[CertificateOut], status_code=201)
async def generate_winners(
    event_id: UUID,
    body: GenerateWinnersRequest,
    db: AsyncSession = Depends(get_db),
    svc: CertificateService = Depends(_svc),
    event_repo: EventRepository = Depends(lambda db=Depends(get_db): EventRepository(db)),
    actor: User = Depends(_require_club_admin),
) -> list[CertificateOut]:
    event = await event_repo.get_event(event_id)
    club_name = event.organizer_club.name if event and event.organizer_club else ""
    event_name = event.title if event else str(event_id)
    winners = [
        {
            "user_id": w.user_id, "name": w.name, "position": w.position,
            "prize_amount": w.prize_amount,
            "bank_account": w.bank_account, "bank_name": w.bank_name,
            "ifsc": w.ifsc, "upi": w.upi,
        }
        for w in body.winners
    ]
    certs = await svc.generate_winners(event_id, event_name, club_name, winners)
    notif_repo = NotificationRepository(db)
    for cert in certs:
        meta = cert.metadata_ or {}
        await notif_repo.create(
            user_id=cert.recipient_id,
            type="CERTIFICATE_ISSUED",
            title=f"Winner certificate: {event_name}",
            body=f"Congratulations! You've been awarded {meta.get('position', 'a prize')} at {event_name}.",
            metadata_={"event_id": str(event_id), "cert_id": str(cert.id)},
        )
    return [_cert_out(c) for c in certs]


@router.get("/certificates/me", response_model=list[CertificateOut])
async def my_certificates(
    svc: CertificateService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[CertificateOut]:
    certs = await svc.my_certificates(actor.id)
    return [_cert_out(c) for c in certs]


@router.get("/certificates/{cert_id}/download")
async def download_certificate(
    cert_id: UUID,
    svc: CertificateService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    cert = await svc.get_certificate(cert_id)
    return {"pdf_url": cert.pdf_url}


@public_router.get("/verify/{unique_code}", response_model=VerifyResponse)
async def verify_certificate(
    unique_code: str,
    svc: CertificateService = Depends(_svc),
) -> VerifyResponse:
    data = await svc.verify_by_code(unique_code)
    return VerifyResponse(**data)
