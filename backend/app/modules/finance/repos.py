from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.finance.models import BudgetCategory, EventBudget, Expense
from app.shared.enums import ExpenseCategory


class FinanceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_budget(self, event_id: UUID) -> EventBudget | None:
        result = await self.db.execute(
            select(EventBudget).where(EventBudget.event_id == event_id)
        )
        return result.scalar_one_or_none()

    async def create_budget(self, **kwargs) -> EventBudget:
        budget = EventBudget(**kwargs)
        self.db.add(budget)
        await self.db.flush()
        return budget

    async def create_category(self, **kwargs) -> BudgetCategory:
        cat = BudgetCategory(**kwargs)
        self.db.add(cat)
        await self.db.flush()
        return cat

    async def list_categories(self, budget_id: UUID) -> list[BudgetCategory]:
        result = await self.db.execute(
            select(BudgetCategory).where(BudgetCategory.budget_id == budget_id)
        )
        return list(result.scalars().all())

    async def create_expense(self, **kwargs) -> Expense:
        expense = Expense(**kwargs)
        self.db.add(expense)
        await self.db.flush()
        return expense

    async def list_expenses(self, event_id: UUID) -> list[Expense]:
        result = await self.db.execute(
            select(Expense).where(Expense.event_id == event_id)
        )
        return list(result.scalars().all())

    async def total_spent(self, event_id: UUID) -> float:
        result = await self.db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.event_id == event_id
            )
        )
        return float(result.scalar_one())

    async def spent_by_category(self, event_id: UUID) -> dict[str, float]:
        result = await self.db.execute(
            select(Expense.category, func.sum(Expense.amount))
            .where(Expense.event_id == event_id)
            .group_by(Expense.category)
        )
        return {row[0]: float(row[1]) for row in result.all()}
