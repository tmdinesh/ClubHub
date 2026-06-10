from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base
from app.shared.enums import ExpenseCategory, ExpenseStatus


class EventBudget(Base):
    __tablename__ = "event_budgets"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_event_budgets_event"),
        Index("ix_event_budgets_event_id", "event_id"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    total_budget: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    categories: Mapped[list["BudgetCategory"]] = relationship(back_populates="budget")


class BudgetCategory(Base):
    __tablename__ = "budget_categories"
    __table_args__ = (Index("ix_budget_categories_budget_id", "budget_id"),)

    budget_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_budgets.id", ondelete="CASCADE"),
        nullable=False,
    )
    category: Mapped[ExpenseCategory] = mapped_column(String(32), nullable=False)
    allocated_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    budget: Mapped["EventBudget"] = relationship(back_populates="categories")


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_event_id", "event_id"),
        Index("ix_expenses_uploaded_by", "uploaded_by"),
        Index("ix_expenses_status", "status"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[ExpenseCategory] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    bill_url: Mapped[str | None] = mapped_column(String(2048))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[ExpenseStatus] = mapped_column(
        String(16), nullable=False, default=ExpenseStatus.PENDING
    )
    notes: Mapped[str | None] = mapped_column(Text)


class EventWinner(Base):
    __tablename__ = "event_winners"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_event_winners_event_user"),
        UniqueConstraint("event_id", "position", name="uq_event_winners_event_position"),
        Index("ix_event_winners_event_id", "event_id"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    prize_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    expense_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True
    )
