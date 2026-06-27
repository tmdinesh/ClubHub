from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.feedback.repos import FeedbackRepository
from app.modules.feedback.schemas import FeedbackFormCreate, FeedbackSubmit, NpsResult, NpsSubmit
from app.modules.feedback.services import FeedbackService

router = APIRouter(tags=["feedback"])


def _svc(db: AsyncSession = Depends(get_db)) -> FeedbackService:
    return FeedbackService(FeedbackRepository(db))


@router.post("/events/{event_id}/feedback/forms", status_code=201)
async def create_form(
    event_id: UUID,
    body: FeedbackFormCreate,
    svc: FeedbackService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    form = await svc.create_form(
        event_id,
        [q.model_dump() for q in body.questions],
        body.closes_at,
    )
    return {"id": str(form.id), "event_id": str(form.event_id)}


@router.get("/events/{event_id}/feedback/questions")
async def get_questions(
    event_id: UUID,
    svc: FeedbackService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[dict]:
    return await svc.get_form_questions(event_id)


@router.get("/events/{event_id}/feedback/status")
async def feedback_status(
    event_id: UUID,
    svc: FeedbackService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    submitted = await svc.has_submitted(event_id, actor)
    return {"submitted": submitted}


@router.post("/events/{event_id}/feedback/submit", status_code=201)
async def submit_feedback(
    event_id: UUID,
    body: FeedbackSubmit,
    svc: FeedbackService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    resp = await svc.submit_feedback(
        event_id,
        [{"question_id": str(a.question_id), "value": a.value} for a in body.answers],
        actor,
    )
    return {"id": str(resp.id), "submitted_at": resp.submitted_at.isoformat()}


@router.get("/events/{event_id}/feedback/results")
async def feedback_results(
    event_id: UUID,
    svc: FeedbackService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    return await svc.get_results(event_id)


@router.post("/events/{event_id}/nps", status_code=201)
async def submit_nps(
    event_id: UUID,
    body: NpsSubmit,
    db: AsyncSession = Depends(get_db),
    svc: FeedbackService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    nps = await svc.submit_nps(event_id, body.score, actor)

    if await svc.has_submitted(event_id, actor):
        import base64
        from pathlib import Path

        from app.core.config import settings
        from app.core.rabbitmq import publish_event
        from app.modules.certificates.models import CertificateType
        from app.modules.certificates.repos import CertificateRepository
        from app.modules.certificates.services import _render_pdf_on_template, _render_pdf_plain
        from app.modules.events.repos import EventRepository

        cert_repo = CertificateRepository(db)
        cert = await cert_repo.get_by_event_user_type(event_id, actor.id, CertificateType.PARTICIPATION)
        if cert:
            event_repo = EventRepository(db)
            event = await event_repo.get_event(event_id)
            meta = cert.metadata_ or {}
            template = await cert_repo.get_template_by_event_type(event_id, CertificateType.PARTICIPATION)
            context = {
                "event_name": meta.get("event_name", event.title if event else ""),
                "club_name": (event.organizer_club.name if event and event.organizer_club else ""),
                "name": meta.get("name", actor.name),
                "certificate_type": "Participation",
                "date": cert.issued_at.strftime("%B %d, %Y"),
                "unique_code": cert.unique_code,
            }
            if template and template.template_file_url and template.placeholders:
                rel = template.template_file_url.removeprefix("/media/")
                template_path = Path(settings.LOCAL_STORAGE_PATH) / rel
                if template_path.exists():
                    pdf_bytes = _render_pdf_on_template(template_path, template.placeholders, context)
                else:
                    pdf_bytes = _render_pdf_plain(context)
            else:
                pdf_bytes = _render_pdf_plain(context)
            try:
                await publish_event("CERTIFICATE_GENERATED", {
                    "recipient_email": actor.email,
                    "recipient_name": meta.get("name", actor.name),
                    "event_name": context["event_name"],
                    "club_name": context["club_name"],
                    "event_date": context["date"],
                    "certificate_type": "Participation",
                    "pdf_b64": base64.b64encode(pdf_bytes).decode(),
                    "unique_code": cert.unique_code,
                })
            except Exception:
                pass

    return {"id": str(nps.id), "score": nps.score}


@router.get("/events/{event_id}/nps", response_model=NpsResult)
async def get_nps(event_id: UUID, svc: FeedbackService = Depends(_svc)) -> NpsResult:
    data = await svc.get_nps(event_id)
    return NpsResult(**data)
