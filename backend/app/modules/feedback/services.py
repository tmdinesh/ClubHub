from __future__ import annotations

from uuid import UUID

from app.modules.auth.models import User
from app.modules.feedback.models import FeedbackForm, FeedbackResponse, NpsScore
from app.modules.feedback.repos import FeedbackRepository
from app.shared.exceptions import BadRequestError, ConflictError, NotFoundError


class FeedbackService:
    def __init__(self, repo: FeedbackRepository) -> None:
        self.repo = repo

    async def create_form(self, event_id: UUID, questions: list[dict], closes_at=None) -> FeedbackForm:
        existing = await self.repo.get_form(event_id)
        if existing:
            raise ConflictError("Feedback form already exists for this event")
        form = await self.repo.create_form(event_id=event_id, closes_at=closes_at)
        for q in questions:
            await self.repo.create_question(form_id=form.id, **q)
        return form

    async def submit_feedback(
        self, event_id: UUID, answers: list[dict], actor: User
    ) -> FeedbackResponse:
        form = await self.repo.get_form(event_id)
        if not form or not form.is_active:
            raise BadRequestError("Feedback form is not available")
        response = await self.repo.create_response(form.id, actor.id)
        for ans in answers:
            await self.repo.create_answer(response.id, ans["question_id"], ans.get("value"))
        return response

    async def get_results(self, event_id: UUID) -> dict:
        form = await self.repo.get_form(event_id)
        if not form:
            raise NotFoundError("Feedback form", event_id)
        questions = await self.repo.list_questions(form.id)
        responses = await self.repo.list_responses(form.id)
        return {
            "form_id": str(form.id),
            "total_responses": len(responses),
            "questions": [{"id": str(q.id), "text": q.question_text, "type": q.question_type} for q in questions],
        }

    async def submit_nps(self, event_id: UUID, score: int, actor: User) -> NpsScore:
        if not (0 <= score <= 10):
            raise BadRequestError("NPS score must be between 0 and 10")
        return await self.repo.create_nps(event_id, actor.id, score)

    async def get_nps(self, event_id: UUID) -> dict:
        scores = await self.repo.list_nps(event_id)
        if not scores:
            return {"nps": None, "total": 0, "promoters": 0, "detractors": 0, "passives": 0}
        total = len(scores)
        promoters = sum(1 for s in scores if s.score >= 9)
        detractors = sum(1 for s in scores if s.score <= 6)
        passives = total - promoters - detractors
        nps = round(((promoters - detractors) / total) * 100, 1)
        return {
            "nps": nps,
            "total": total,
            "promoters": promoters,
            "detractors": detractors,
            "passives": passives,
        }
