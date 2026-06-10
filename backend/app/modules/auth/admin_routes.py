from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.repos import UserRepository
from app.modules.auth.schemas import AdminClubUpdate, AdminUserCreate, AdminUserUpdate, UserOut
from app.modules.events.repos import EventRepository
from app.modules.events.schemas import ClubOut
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError, NotFoundError

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_super_admin(actor: User = Depends(get_current_user)) -> User:
    if actor.role != UserRole.SUPER_ADMIN:
        raise ForbiddenError("Super Admin required")
    return actor


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
async def list_users(
    role: UserRole | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_super_admin),
) -> list[UserOut]:
    repo = UserRepository(db)
    users = await repo.list_all(role_filter=role)
    return [UserOut.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    body: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_super_admin),
) -> UserOut:
    repo = UserRepository(db)
    user = await repo.provision(body.email, body.name, body.role, body.club_id)
    return UserOut.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    body: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_super_admin),
) -> UserOut:
    repo = UserRepository(db)
    updates = body.model_dump(exclude_none=True)
    user = await repo.update_user(user_id, **updates)
    if not user:
        raise NotFoundError("User", user_id)
    return UserOut.model_validate(user)


# ── Clubs ─────────────────────────────────────────────────────────────────────

@router.get("/clubs", response_model=list[ClubOut])
async def list_clubs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_super_admin),
) -> list[ClubOut]:
    repo = EventRepository(db)
    clubs = await repo.list_clubs()
    return [ClubOut.model_validate(c) for c in clubs]


@router.patch("/clubs/{club_id}", response_model=ClubOut)
async def update_club(
    club_id: UUID,
    body: AdminClubUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_super_admin),
) -> ClubOut:
    repo = EventRepository(db)
    club = await repo.update_club(club_id, faculty_advisor_id=body.faculty_advisor_id)
    if not club:
        raise NotFoundError("Club", club_id)
    return ClubOut.model_validate(club)
