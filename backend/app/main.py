from __future__ import annotations

import asyncio
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
from app.modules.events.routes import clubs_router, dept_router, router as events_router
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
    task1 = asyncio.create_task(_daily_purge_loop())
    task2 = asyncio.create_task(_daily_reminder_loop())
    task3 = asyncio.create_task(_daily_event_close_loop())
    yield
    task1.cancel()
    task2.cancel()
    task3.cancel()
    await close_redis()


async def _daily_purge_loop() -> None:
    """Run inactive-user cleanup once per day."""
    while True:
        await asyncio.sleep(86400)  # 24 hours
        try:
            from app.core.database import AsyncSessionLocal
            from app.modules.auth.cleanup import delete_inactive_users
            async with AsyncSessionLocal() as db:
                await delete_inactive_users(db)
        except Exception:
            pass


async def _daily_reminder_loop() -> None:
    """Send event reminder emails once per day for events starting in ~24 hours."""
    while True:
        await asyncio.sleep(86400)
        try:
            from datetime import datetime, timedelta, timezone
            from sqlalchemy import select
            from app.core.database import AsyncSessionLocal
            from app.core.email import send_event_reminder_email
            from app.modules.events.models import Club, Event
            from app.modules.registration.models import Registration
            from app.modules.auth.models import User
            from app.shared.enums import RegistrationStatus

            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                window_start = now + timedelta(hours=23)
                window_end = now + timedelta(hours=25)

                events_result = await db.execute(
                    select(Event).where(
                        Event.start_datetime >= window_start,
                        Event.start_datetime <= window_end,
                        Event.status == "PUBLISHED",
                    )
                )
                events = events_result.scalars().all()

                for event in events:
                    club_row = (await db.execute(
                        select(Club).where(Club.id == event.organizer_club_id)
                    )).scalar_one_or_none()
                    club_name = club_row.name if club_row else "PSG Tech"

                    regs_result = await db.execute(
                        select(Registration, User)
                        .join(User, User.id == Registration.user_id)
                        .where(
                            Registration.event_id == event.id,
                            Registration.status == RegistrationStatus.CONFIRMED,
                        )
                    )
                    for reg, user in regs_result.all():
                        try:
                            event_url = f"https://clubhub.psgtech.ac.in/events/{event.id}"
                            start_str = event.start_datetime.strftime("%d %b %Y, %I:%M %p")
                            await send_event_reminder_email(
                                recipient_email=user.email,
                                recipient_name=user.name,
                                event_title=event.title,
                                club_name=club_name,
                                event_url=event_url,
                                start_datetime=start_str,
                                venue=event.venue,
                            )
                        except Exception:
                            pass
        except Exception:
            pass


async def _daily_event_close_loop() -> None:
    """
    Runs once per day. For every PUBLISHED event whose end_datetime has passed:
    - Days 0, 2, 4: send reminder email to club admin.
    - Day 6: send reminder to club admin + urgent warning to faculty advisor.
    - Day 7+: auto-complete the event.
    """
    while True:
        await asyncio.sleep(86400)
        try:
            from datetime import date, datetime, timedelta, timezone
            from sqlalchemy import and_, select
            from app.core.database import AsyncSessionLocal
            from app.core.email import (
                send_event_completion_reminder_email,
                send_faculty_close_warning_email,
                send_feedback_request_email,
            )
            from app.modules.events.models import Club, Event
            from app.modules.auth.models import User
            from app.modules.registration.models import Registration
            from app.shared.enums import EventStatus, RegistrationStatus, UserRole

            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                today = now.date()

                # Fetch all PUBLISHED events that have ended
                result = await db.execute(
                    select(Event).where(
                        Event.status == EventStatus.PUBLISHED,
                        Event.end_datetime != None,
                        Event.end_datetime < now,
                        Event.is_deleted == False,
                    )
                )
                events = result.scalars().all()

                for event in events:
                    end_date = event.end_datetime.astimezone(timezone.utc).date()
                    days_since_end = (today - end_date).days

                    club = (await db.execute(
                        select(Club).where(Club.id == event.organizer_club_id)
                    )).scalar_one_or_none()
                    club_name = club.name if club else "PSG Tech"
                    manage_url = (
                        f"{__import__('app').core.config.settings.FRONTEND_URL}"
                        f"/manage/{event.id}/overview"
                    )

                    # Auto-complete on day 7
                    if days_since_end >= 7:
                        try:
                            from app.modules.events.repos import EventRepository
                            from app.modules.registration.repos import RegistrationRepository
                            from app.modules.notifications.repos import NotificationRepository
                            from app.modules.feedback.services import FeedbackService
                            from app.modules.feedback.repos import FeedbackRepository

                            event.status = EventStatus.COMPLETED
                            feedback_svc = FeedbackService(FeedbackRepository(db))
                            await feedback_svc.setup_for_event(event.id)

                            reg_repo = RegistrationRepository(db)
                            users = await reg_repo.list_confirmed_with_users(event.id)
                            feedback_url = (
                                f"{__import__('app').core.config.settings.FRONTEND_URL}"
                                f"/dashboard/feedback/{event.id}"
                            )
                            for u in users:
                                try:
                                    await send_feedback_request_email(
                                        recipient_email=u["email"],
                                        recipient_name=u["name"],
                                        event_title=event.title,
                                        club_name=club_name,
                                        feedback_url=feedback_url,
                                    )
                                except Exception:
                                    pass
                            await db.commit()
                        except Exception:
                            await db.rollback()
                        continue

                    # Reminder emails on days 0, 2, 4, 6
                    if days_since_end in (0, 2, 4, 6):
                        days_remaining = 7 - days_since_end

                        # Find club admin
                        admin = (await db.execute(
                            select(User).where(
                                User.club_id == event.organizer_club_id,
                                User.role == UserRole.CLUB_ADMIN,
                                User.is_active == True,
                            )
                        )).scalar_one_or_none()

                        if admin:
                            try:
                                await send_event_completion_reminder_email(
                                    recipient_email=admin.email,
                                    recipient_name=admin.name,
                                    event_title=event.title,
                                    club_name=club_name,
                                    days_since_end=days_since_end,
                                    days_remaining=days_remaining,
                                    manage_url=manage_url,
                                )
                            except Exception:
                                pass

                        # Day 6: also warn faculty advisor
                        if days_since_end == 6 and event.faculty_advisor_id:
                            advisor = (await db.execute(
                                select(User).where(User.id == event.faculty_advisor_id)
                            )).scalar_one_or_none()
                            if advisor:
                                try:
                                    await send_faculty_close_warning_email(
                                        recipient_email=advisor.email,
                                        recipient_name=advisor.name,
                                        event_title=event.title,
                                        club_name=club_name,
                                        manage_url=manage_url,
                                    )
                                except Exception:
                                    pass

        except Exception:
            pass


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
app.include_router(dept_router)
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
