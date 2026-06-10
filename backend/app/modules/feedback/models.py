from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base
from app.shared.enums import QuestionType


class FeedbackForm(Base):
    __tablename__ = "feedback_forms"
    __table_args__ = (Index("ix_feedback_forms_event_id", "event_id"),)

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    questions: Mapped[list["FeedbackQuestion"]] = relationship(back_populates="form")
    responses: Mapped[list["FeedbackResponse"]] = relationship(back_populates="form")


class FeedbackQuestion(Base):
    __tablename__ = "feedback_questions"
    __table_args__ = (Index("ix_feedback_questions_form_id", "form_id"),)

    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("feedback_forms.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(String(24), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    form: Mapped["FeedbackForm"] = relationship(back_populates="questions")


class FeedbackResponse(Base):
    __tablename__ = "feedback_responses"
    __table_args__ = (
        Index("ix_feedback_responses_form_id", "form_id"),
        Index("ix_feedback_responses_respondent_id", "respondent_id"),
    )

    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("feedback_forms.id", ondelete="CASCADE"),
        nullable=False,
    )
    respondent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    form: Mapped["FeedbackForm"] = relationship(back_populates="responses")
    answers: Mapped[list["FeedbackAnswer"]] = relationship(back_populates="response")


class FeedbackAnswer(Base):
    __tablename__ = "feedback_answers"
    __table_args__ = (
        Index("ix_feedback_answers_response_id", "response_id"),
        Index("ix_feedback_answers_question_id", "question_id"),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("feedback_responses.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("feedback_questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    answer_value: Mapped[str | None] = mapped_column(Text)

    response: Mapped["FeedbackResponse"] = relationship(back_populates="answers")


class NpsScore(Base):
    __tablename__ = "nps_scores"
    __table_args__ = (
        Index("ix_nps_scores_event_id", "event_id"),
        Index("ix_nps_scores_respondent_id", "respondent_id"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    respondent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-10
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
