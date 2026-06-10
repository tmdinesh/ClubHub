"""FastAPI dependency: extract and validate the current user from Bearer JWT."""
from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.repos import UserRepository
from app.modules.auth.services import AuthService
from app.shared.exceptions import UnauthorizedError
from sqlalchemy.ext.asyncio import AsyncSession

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise UnauthorizedError("Bearer token required")
    repo = UserRepository(db)
    service = AuthService(repo)
    return await service.get_current_user_from_token(credentials.credentials)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        repo = UserRepository(db)
        service = AuthService(repo)
        return await service.get_current_user_from_token(credentials.credentials)
    except Exception:
        return None
