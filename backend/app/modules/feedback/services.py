from __future__ import annotations

from uuid import UUID

from app.modules.auth.models import User
from app.modules.feedback.models import FeedbackForm, FeedbackResponse, NpsScore
from app.modules.feedback.repos import FeedbackRepository
from app.shared.enums import QuestionType
from app.shared.exceptions import BadRequestError, ConflictError, NotFoundError

# Fixed question set — same for every event
FIXED_QUESTIONS = [
    {"order": 1, "question_type": QuestionType.RATING, "is_required": True,
     "question_text": "How would you rate the overall organisation of the event?"},
    {"order": 2, "question_type": QuestionType.RATING, "is_required": True,
     "question_text": "How satisfied were you with the venue and facilities?"},
    {"order": 3, "question_type": QuestionType.RATING, "is_required": True,
     "question_text": "How relevant and valuable was the event content?"},
    {"order": 4, "question_type": QuestionType.TEXT, "is_required": False,
     "question_text": "What did you enjoy most about the event?"},
    {"order": 5, "question_type": QuestionType.TEXT, "is_required": False,
     "question_text": "What could be improved for future editions?"},
]


class FeedbackService:
    def __init__(self, repo: FeedbackRepository) -> None:
        self.repo = repo

    async def setup_for_event(self, event_id: UUID) -> FeedbackForm:
        """Auto-create the fixed feedback form when an event is marked complete."""
        existing = await self.repo.get_form(event_id)
        if existing:
            return existing
        form = await self.repo.create_form(event_id=event_id)
        for q in FIXED_QUESTIONS:
            await self.repo.create_question(form_id=form.id, **q)
        return form

    async def create_form(self, event_id: UUID, questions: list[dict], closes_at=None) -> FeedbackForm:
        existing = await self.repo.get_form(event_id)
        if existing:
            raise ConflictError("Feedback form already exists for this event")
        form = await self.repo.create_form(event_id=event_id, closes_at=closes_at)
        for q in questions:
            await self.repo.create_question(form_id=form.id, **q)
        return form

    async def has_submitted(self, event_id: UUID, actor: User) -> bool:
        form = await self.repo.get_form(event_id)
        if not form:
            return False
        submitted = await self.repo.has_responded(form.id, actor.id)
        nps_done = await self.repo.has_nps(event_id, actor.id)
        return submitted and nps_done

    async def submit_feedback(
        self, event_id: UUID, answers: list[dict], actor: User
    ) -> FeedbackResponse:
        form = await self.repo.get_form(event_id)
        if not form or not form.is_active:
            raise BadRequestError("Feedback form is not available")
        if await self.repo.has_responded(form.id, actor.id):
            raise ConflictError("You have already submitted feedback for this event")
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
        total = len(responses)

        question_results = []
        for q in questions:
            answers = await self.repo.list_answers_for_question(q.id)
            entry: dict = {
                "id": str(q.id),
                "text": q.question_text,
                "type": q.question_type,
                "order": q.order,
                "response_count": len(answers),
            }
            if q.question_type == QuestionType.RATING:
                vals = [float(a.answer_value) for a in answers if a.answer_value is not None]
                entry["avg"] = round(sum(vals) / len(vals), 2) if vals else None
                entry["distribution"] = {
                    str(i): sum(1 for v in vals if int(v) == i) for i in range(1, 6)
                }
            elif q.question_type == QuestionType.TEXT:
                entry["responses"] = [a.answer_value for a in answers if a.answer_value]
            question_results.append(entry)

        return {
            "form_id": str(form.id),
            "total_responses": total,
            "questions": question_results,
        }

    async def get_form_questions(self, event_id: UUID) -> list[dict]:
        form = await self.repo.get_form(event_id)
        if not form:
            raise NotFoundError("Feedback form", event_id)
        questions = await self.repo.list_questions(form.id)
        return [
            {"id": str(q.id), "text": q.question_text, "type": q.question_type,
             "order": q.order, "is_required": q.is_required}
            for q in questions
        ]

    async def submit_nps(self, event_id: UUID, score: int, actor: User) -> NpsScore:
        if not (0 <= score <= 10):
            raise BadRequestError("NPS score must be between 0 and 10")
        if await self.repo.has_nps(event_id, actor.id):
            raise ConflictError("You have already submitted an NPS score for this event")
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
