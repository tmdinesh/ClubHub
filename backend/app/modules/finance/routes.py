from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.finance.repos import FinanceRepository
from app.modules.finance.schemas import BudgetCreate, ExpenseCreate, ExpenseOut, FinanceSummary, WinnerOut, WinnerSet
from app.modules.finance.services import FinanceService

router = APIRouter(tags=["finance"])


def _svc(db: AsyncSession = Depends(get_db)) -> FinanceService:
    return FinanceService(FinanceRepository(db))


@router.post("/events/{event_id}/budget", status_code=201)
async def set_budget(
    event_id: UUID,
    body: BudgetCreate,
    svc: FinanceService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> dict:
    budget = await svc.set_budget(
        event_id, body.total_budget, body.notes,
        [c.model_dump() for c in body.categories], actor
    )
    return {"id": str(budget.id), "total_budget": float(budget.total_budget)}


@router.get("/events/{event_id}/budget", response_model=FinanceSummary)
async def get_budget(event_id: UUID, svc: FinanceService = Depends(_svc)) -> FinanceSummary:
    data = await svc.get_budget_with_actuals(event_id)
    return FinanceSummary(**data)


@router.post("/events/{event_id}/expenses", response_model=ExpenseOut, status_code=201)
async def add_expense(
    event_id: UUID,
    body: ExpenseCreate,
    svc: FinanceService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> ExpenseOut:
    expense = await svc.add_expense(
        event_id, body.category, body.title, body.amount, body.bill_url, body.notes, actor
    )
    return ExpenseOut.model_validate(expense)


@router.get("/events/{event_id}/expenses", response_model=list[ExpenseOut])
async def list_expenses(event_id: UUID, svc: FinanceService = Depends(_svc)) -> list[ExpenseOut]:
    expenses = await svc.list_expenses(event_id)
    return [ExpenseOut.model_validate(e) for e in expenses]


@router.get("/events/{event_id}/finance/summary", response_model=FinanceSummary)
async def finance_summary(event_id: UUID, svc: FinanceService = Depends(_svc)) -> FinanceSummary:
    data = await svc.get_budget_with_actuals(event_id)
    return FinanceSummary(**data)


@router.get("/events/{event_id}/winners", response_model=list[WinnerOut])
async def list_winners(event_id: UUID, svc: FinanceService = Depends(_svc)) -> list[WinnerOut]:
    return await svc.list_winners(event_id)


@router.post("/events/{event_id}/winners", response_model=WinnerOut, status_code=201)
async def set_winner(
    event_id: UUID,
    body: WinnerSet,
    svc: FinanceService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> WinnerOut:
    winner = await svc.set_winner(event_id, body.user_id, body.position, body.prize_amount, actor)
    return WinnerOut(**winner)


@router.delete("/events/{event_id}/winners/{position}", status_code=204, response_model=None)
async def remove_winner(
    event_id: UUID,
    position: int,
    svc: FinanceService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> None:
    await svc.remove_winner(event_id, position, actor)
