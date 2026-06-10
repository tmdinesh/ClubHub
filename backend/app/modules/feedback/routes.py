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
    svc: FeedbackService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    nps = await svc.submit_nps(event_id, body.score, actor)
    return {"id": str(nps.id), "score": nps.score}


@router.get("/events/{event_id}/nps", response_model=NpsResult)
async def get_nps(event_id: UUID, svc: FeedbackService = Depends(_svc)) -> NpsResult:
    data = await svc.get_nps(event_id)
    return NpsResult(**data)
