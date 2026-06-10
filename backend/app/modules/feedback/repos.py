from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.feedback.models import (
    FeedbackAnswer, FeedbackForm, FeedbackQuestion, FeedbackResponse, NpsScore,
)


class FeedbackRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_form(self, **kwargs) -> FeedbackForm:
        form = FeedbackForm(**kwargs)
        self.db.add(form)
        await self.db.flush()
        return form

    async def get_form(self, event_id: UUID) -> FeedbackForm | None:
        result = await self.db.execute(
            select(FeedbackForm).where(FeedbackForm.event_id == event_id)
        )
        return result.scalar_one_or_none()

    async def create_question(self, **kwargs) -> FeedbackQuestion:
        q = FeedbackQuestion(**kwargs)
        self.db.add(q)
        await self.db.flush()
        return q

    async def create_response(self, form_id: UUID, respondent_id: UUID) -> FeedbackResponse:
        resp = FeedbackResponse(
            form_id=form_id,
            respondent_id=respondent_id,
            submitted_at=datetime.now(timezone.utc),
        )
        self.db.add(resp)
        await self.db.flush()
        return resp

    async def create_answer(self, response_id: UUID, question_id: UUID, value: str | None) -> FeedbackAnswer:
        ans = FeedbackAnswer(response_id=response_id, question_id=question_id, answer_value=value)
        self.db.add(ans)
        await self.db.flush()
        return ans

    async def list_responses(self, form_id: UUID) -> list[FeedbackResponse]:
        result = await self.db.execute(
            select(FeedbackResponse).where(FeedbackResponse.form_id == form_id)
        )
        return list(result.scalars().all())

    async def list_questions(self, form_id: UUID) -> list[FeedbackQuestion]:
        result = await self.db.execute(
            select(FeedbackQuestion).where(FeedbackQuestion.form_id == form_id).order_by(FeedbackQuestion.order)
        )
        return list(result.scalars().all())

    async def list_answers(self, response_id: UUID) -> list[FeedbackAnswer]:
        result = await self.db.execute(
            select(FeedbackAnswer).where(FeedbackAnswer.response_id == response_id)
        )
        return list(result.scalars().all())

    async def create_nps(self, event_id: UUID, respondent_id: UUID, score: int) -> NpsScore:
        nps = NpsScore(
            event_id=event_id,
            respondent_id=respondent_id,
            score=score,
            submitted_at=datetime.now(timezone.utc),
        )
        self.db.add(nps)
        await self.db.flush()
        return nps

    async def list_nps(self, event_id: UUID) -> list[NpsScore]:
        result = await self.db.execute(
            select(NpsScore).where(NpsScore.event_id == event_id)
        )
        return list(result.scalars().all())
