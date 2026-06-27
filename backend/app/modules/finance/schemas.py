from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.shared.enums import ExpenseCategory, ExpenseStatus


class BudgetCategoryIn(BaseModel):
    category: ExpenseCategory
    allocated_amount: float


class BudgetCreate(BaseModel):
    total_budget: float
    notes: str | None = None
    categories: list[BudgetCategoryIn] = []


class ExpenseCreate(BaseModel):
    category: ExpenseCategory
    title: str
    amount: float
    bill_url: str | None = None
    notes: str | None = None


class ExpenseOut(BaseModel):
    id: UUID
    event_id: UUID
    category: ExpenseCategory
    title: str
    amount: float
    bill_url: str | None
    status: ExpenseStatus
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CategorySummary(BaseModel):
    category: str
    allocated: float
    spent: float
    variance: float


class FinanceSummary(BaseModel):
    total_budget: float
    total_spent: float
    remaining: float
    by_category: list[CategorySummary]


class WinnerSet(BaseModel):
    user_id: UUID
    position: int
    prize_amount: float | None = None


class WinnerOut(BaseModel):
    id: str
    position: int
    prize_amount: float | None
    expense_id: str | None
    user_id: str
    participant_name: str
    participant_email: str
    roll_number: str | None
    bank_account_name: str | None
    bank_account_number: str | None
    bank_ifsc: str | None
    upi: str | None = None
