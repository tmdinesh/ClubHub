from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.repos import UserRepository
from app.modules.auth.schemas import DevLoginRequest, LogoutRequest, RefreshRequest, TokenPair, UserOut
from app.modules.auth.services import AuthService
from app.shared.exceptions import ForbiddenError

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(UserRepository(db))


@router.get("/google/login")
async def google_login(service: AuthService = Depends(_get_service)) -> RedirectResponse:
    state = secrets.token_urlsafe(16)
    url = service.get_google_auth_url(state)
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    code: str,
    service: AuthService = Depends(_get_service),
) -> RedirectResponse:
    _, access_token, refresh_token = await service.google_callback(code)
    frontend_url = settings.FRONTEND_URL
    return RedirectResponse(
        url=f"{frontend_url}/auth/callback?access_token={access_token}&refresh_token={refresh_token}"
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    body: RefreshRequest,
    service: AuthService = Depends(_get_service),
) -> TokenPair:
    access_token, refresh_token = await service.refresh_tokens(body.refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=204, response_model=None)
async def logout(
    body: LogoutRequest,
    service: AuthService = Depends(_get_service),
) -> Response:
    await service.logout(body.refresh_token)
    return Response(status_code=204)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.post("/dev-login", response_model=TokenPair, tags=["auth (dev)"])
async def dev_login(
    body: DevLoginRequest,
    service: AuthService = Depends(_get_service),
) -> TokenPair:
    """
    Development-only login. Returns a real token pair without Google OAuth.
    Only available when ENVIRONMENT=development.
    """
    if settings.ENVIRONMENT != "development":
        raise ForbiddenError("Dev login is only available in development mode")
    access_token, refresh_token = await service.dev_login(body.email, body.name, body.role)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)
