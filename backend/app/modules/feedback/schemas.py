from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.shared.enums import QuestionType


class QuestionCreate(BaseModel):
    question_text: str
    question_type: QuestionType
    order: int = 0
    is_required: bool = True


class FeedbackFormCreate(BaseModel):
    questions: list[QuestionCreate]
    closes_at: datetime | None = None


class AnswerIn(BaseModel):
    question_id: UUID
    value: str | None = None


class FeedbackSubmit(BaseModel):
    answers: list[AnswerIn]


class NpsSubmit(BaseModel):
    score: int


class NpsResult(BaseModel):
    nps: float | None
    total: int
    promoters: int
    detractors: int
    passives: int
