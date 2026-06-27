from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.finance.models import BudgetCategory, EventBudget, EventWinner, Expense
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

    async def get_expense(self, expense_id: UUID) -> Expense | None:
        result = await self.db.execute(
            select(Expense).where(Expense.id == expense_id)
        )
        return result.scalar_one_or_none()

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

    async def list_winners(self, event_id: UUID) -> list[dict]:
        from app.modules.auth.models import User
        from app.modules.certificates.models import Certificate
        from app.shared.enums import CertificateType
        q = (
            select(
                EventWinner.id,
                EventWinner.position,
                EventWinner.prize_amount,
                EventWinner.expense_id,
                EventWinner.user_id,
                User.name.label("participant_name"),
                User.email.label("participant_email"),
                User.roll_number.label("roll_number"),
                Certificate.metadata_.label("cert_meta"),
            )
            .join(User, EventWinner.user_id == User.id)
            .outerjoin(
                Certificate,
                (Certificate.event_id == EventWinner.event_id)
                & (Certificate.recipient_id == EventWinner.user_id)
                & (Certificate.certificate_type == CertificateType.WINNER),
            )
            .where(EventWinner.event_id == event_id)
            .order_by(EventWinner.position)
        )
        rows = await self.db.execute(q)
        return [
            {
                "id": str(r.id),
                "position": r.position,
                "prize_amount": float(r.prize_amount) if r.prize_amount else None,
                "expense_id": str(r.expense_id) if r.expense_id else None,
                "user_id": str(r.user_id),
                "participant_name": r.participant_name,
                "participant_email": r.participant_email,
                "roll_number": r.roll_number,
                "bank_account_name": (r.cert_meta or {}).get("bank_name"),
                "bank_account_number": (r.cert_meta or {}).get("bank_account"),
                "bank_ifsc": (r.cert_meta or {}).get("ifsc"),
                "upi": (r.cert_meta or {}).get("upi"),
            }
            for r in rows
        ]

    async def get_winner_by_position(self, event_id: UUID, position: int) -> EventWinner | None:
        result = await self.db.execute(
            select(EventWinner).where(
                EventWinner.event_id == event_id, EventWinner.position == position
            )
        )
        return result.scalar_one_or_none()

    async def create_winner(self, **kwargs) -> EventWinner:
        winner = EventWinner(**kwargs)
        self.db.add(winner)
        await self.db.flush()
        return winner

    async def delete_winner(self, winner: EventWinner) -> None:
        await self.db.delete(winner)
        await self.db.flush()
