from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.redis import close_redis
from app.shared.exceptions import AppException

# ── Routers ───────────────────────────────────────────────────────────────────
from app.modules.auth.routes import router as auth_router
from app.modules.auth.admin_routes import router as admin_router
from app.modules.events.routes import clubs_router, router as events_router
from app.modules.registration.routes import router as registration_router
from app.modules.teams.routes import router as teams_router
from app.modules.attendance.routes import router as attendance_router
from app.modules.attendance.routes import events_router as attendance_events_router
from app.modules.attendance.cred_routes import router as attendance_cred_router
from app.modules.attendance.cred_routes import public_router as attendance_login_router
from app.modules.certificates.routes import public_router as cert_public_router
from app.modules.certificates.routes import router as cert_router
from app.modules.finance.routes import router as finance_router
from app.modules.feedback.routes import router as feedback_router
from app.modules.analytics.routes import router as analytics_router
from app.modules.notifications.routes import router as notifications_router
from app.modules.announcements.routes import router as announcements_router


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    yield
    await close_redis()


app = FastAPI(
    title="College Club Event Operations Platform",
    version="1.0.0",
    description="Modular monolith for managing college club events end-to-end.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error_code, "message": exc.message, "detail": exc.detail},
    )


# ── Register routers ──────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(events_router)
app.include_router(clubs_router)
app.include_router(registration_router)
app.include_router(teams_router)
app.include_router(attendance_router)
app.include_router(attendance_events_router)
app.include_router(attendance_cred_router)
app.include_router(attendance_login_router)
app.include_router(cert_router)
app.include_router(cert_public_router)
app.include_router(finance_router)
app.include_router(feedback_router)
app.include_router(analytics_router)
app.include_router(notifications_router)
app.include_router(announcements_router)

# Serve uploaded media files
_media_dir = Path(settings.LOCAL_STORAGE_PATH)
_media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_media_dir)), name="media")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
