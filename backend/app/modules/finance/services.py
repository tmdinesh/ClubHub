from __future__ import annotations

from uuid import UUID

from app.modules.auth.models import User
from app.modules.finance.models import EventBudget, EventWinner, Expense
from app.modules.finance.repos import FinanceRepository
from app.shared.enums import ExpenseCategory
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

    async def list_winners(self, event_id: UUID) -> list[dict]:
        return await self.repo.list_winners(event_id)

    async def set_winner(
        self, event_id: UUID, user_id: UUID, position: int, prize_amount: float | None, actor: User
    ) -> dict:
        existing = await self.repo.get_winner_by_position(event_id, position)
        if existing:
            # Update the existing row in place
            existing.user_id = user_id
            existing.prize_amount = prize_amount

            if prize_amount and prize_amount > 0:
                ordinal = {1: "1st", 2: "2nd", 3: "3rd"}.get(position, f"{position}th")
                if existing.expense_id:
                    expense = await self.repo.get_expense(existing.expense_id)
                    if expense:
                        expense.amount = prize_amount
                        expense.uploaded_by = actor.id
                        await self.repo.db.flush()
                    else:
                        expense = await self.repo.create_expense(
                            event_id=event_id,
                            category=ExpenseCategory.PRIZES,
                            title=f"Cash prize — {ordinal} place",
                            amount=prize_amount,
                            bill_url=None,
                            notes="Auto-created from winner record",
                            uploaded_by=actor.id,
                        )
                        existing.expense_id = expense.id
                else:
                    expense = await self.repo.create_expense(
                        event_id=event_id,
                        category=ExpenseCategory.PRIZES,
                        title=f"Cash prize — {ordinal} place",
                        amount=prize_amount,
                        bill_url=None,
                        notes="Auto-created from winner record",
                        uploaded_by=actor.id,
                    )
                    existing.expense_id = expense.id
            else:
                # Prize removed — delete the old expense if it exists
                if existing.expense_id:
                    expense = await self.repo.get_expense(existing.expense_id)
                    if expense:
                        await self.repo.db.delete(expense)
                    existing.expense_id = None

            await self.repo.db.flush()
            winners = await self.repo.list_winners(event_id)
            return next(w for w in winners if w["id"] == str(existing.id))

        # No existing row — create fresh
        expense_id = None
        if prize_amount and prize_amount > 0:
            ordinal = {1: "1st", 2: "2nd", 3: "3rd"}.get(position, f"{position}th")
            expense = await self.repo.create_expense(
                event_id=event_id,
                category=ExpenseCategory.PRIZES,
                title=f"Cash prize — {ordinal} place",
                amount=prize_amount,
                bill_url=None,
                notes="Auto-created from winner record",
                uploaded_by=actor.id,
            )
            expense_id = expense.id

        winner = await self.repo.create_winner(
            event_id=event_id,
            user_id=user_id,
            position=position,
            prize_amount=prize_amount,
            expense_id=expense_id,
        )
        winners = await self.repo.list_winners(event_id)
        return next(w for w in winners if w["id"] == str(winner.id))

    async def remove_winner(self, event_id: UUID, position: int, actor: User) -> None:
        winner = await self.repo.get_winner_by_position(event_id, position)
        if not winner:
            raise NotFoundError("Winner", position)
        await self.repo.delete_winner(winner)
