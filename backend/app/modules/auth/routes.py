from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.repos import UserRepository
from app.modules.auth.schemas import LogoutRequest, RefreshRequest, SuperAdminLoginRequest, TokenPair, UserOut
from app.modules.auth.services import AuthService

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
    service: AuthService = Depends(_get_service),
    code: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    frontend_url = settings.FRONTEND_URL
    if error or not code:
        return RedirectResponse(url=f"{frontend_url}/login?error=access_denied")
    _, access_token, refresh_token = await service.google_callback(code)
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


@router.post("/super-admin/login", response_model=TokenPair, tags=["auth"])
async def super_admin_login(
    body: SuperAdminLoginRequest,
    service: AuthService = Depends(_get_service),
) -> TokenPair:
    """Password-based login for the super admin account configured in environment variables."""
    access_token, refresh_token = await service.super_admin_login(body.email, body.password)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)
