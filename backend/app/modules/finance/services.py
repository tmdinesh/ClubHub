from __future__ import annotations

from uuid import UUID

from app.modules.auth.models import User
from app.modules.finance.models import EventBudget, Expense
from app.modules.finance.repos import FinanceRepository
from app.shared.exceptions import ConflictError, NotFoundError


class FinanceService:
    def __init__(self, repo: FinanceRepository) -> None:
        self.repo = repo

    async def set_budget(
        self, event_id: UUID, total_budget: float, notes: str | None, categories: list[dict], actor: User
    ) -> EventBudget:
        existing = await self.repo.get_budget(event_id)
        if existing:
            raise ConflictError("Budget already set for this event")
        budget = await self.repo.create_budget(event_id=event_id, total_budget=total_budget, notes=notes)
        for cat in categories:
            await self.repo.create_category(budget_id=budget.id, **cat)
        return budget

    async def get_budget_with_actuals(self, event_id: UUID) -> dict:
        budget = await self.repo.get_budget(event_id)
        if not budget:
            raise NotFoundError("Budget", event_id)
        cats = await self.repo.list_categories(budget.id)
        spent_map = await self.repo.spent_by_category(event_id)
        total_spent = sum(spent_map.values())
        by_category = []
        for cat in cats:
            spent = spent_map.get(cat.category, 0.0)
            by_category.append({
                "category": cat.category,
                "allocated": float(cat.allocated_amount),
                "spent": spent,
                "variance": float(cat.allocated_amount) - spent,
            })
        return {
            "total_budget": float(budget.total_budget),
            "total_spent": total_spent,
            "remaining": float(budget.total_budget) - total_spent,
            "by_category": by_category,
        }

    async def add_expense(
        self, event_id: UUID, category: str, title: str, amount: float,
        bill_url: str | None, notes: str | None, actor: User
    ) -> Expense:
        return await self.repo.create_expense(
            event_id=event_id, category=category, title=title, amount=amount,
            bill_url=bill_url, notes=notes, uploaded_by=actor.id,
        )

    async def list_expenses(self, event_id: UUID) -> list[Expense]:
        return await self.repo.list_expenses(event_id)
