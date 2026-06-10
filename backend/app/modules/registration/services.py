from __future__ import annotations

import os
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from uuid import UUID

import qrcode
from jose import jwt

from app.core.config import settings
from app.core.redis import get_redis_client
from app.modules.auth.models import User
from app.modules.events.repos import EventRepository
from app.modules.registration.events import RegistrationConfirmed, WaitlistPromoted
from app.modules.registration.models import Registration
from app.modules.registration.repos import RegistrationRepository
from app.shared.enums import EventStatus, RegistrationStatus
from app.shared.exceptions import BadRequestError, ConflictError, NotFoundError


class RegistrationService:
    def __init__(self, repo: RegistrationRepository, event_repo: EventRepository,
                 notif_repo=None) -> None:
        self.repo = repo
        self.event_repo = event_repo
        self.notif_repo = notif_repo

    def _make_qr_token(self, reg_id: str, event_id: str) -> str:
        payload = {
            "reg_id": reg_id,
            "event_id": event_id,
            "iat": int(datetime.now(timezone.utc).timestamp()),
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    def _write_qr_png(self, reg_id: str, qr_token: str) -> str:
        """Generate a QR PNG from the token and persist it. Returns the served URL path."""
        try:
            qr_dir = Path(settings.LOCAL_STORAGE_PATH) / "qr"
            qr_dir.mkdir(parents=True, exist_ok=True)
            img = qrcode.make(qr_token)
            png_path = qr_dir / f"{reg_id}.png"
            img.save(str(png_path))
        except OSError:
            pass  # storage path not available (e.g. unit test environment)
        return f"/media/qr/{reg_id}.png"

    async def register(self, event_id: UUID, actor: User) -> Registration:
        event = await self.event_repo.get_event(event_id)
        if not event:
            raise NotFoundError("Event", event_id)
        if event.status != EventStatus.PUBLISHED:
            raise BadRequestError("Event is not open for registration")

        now = datetime.now(timezone.utc)
        if event.registration_end and now > event.registration_end:
            raise BadRequestError("Registration period has ended")
        if event.registration_start and now < event.registration_start:
            raise BadRequestError("Registration has not started yet")

        existing = await self.repo.get_by_event_user(event_id, actor.id)
        if existing and existing.status != RegistrationStatus.CANCELLED:
            raise ConflictError("Already registered for this event")

        # Redis lock prevents concurrent over-booking near max_participants cap
        redis = get_redis_client()
        lock_key = f"reg_lock:{event_id}"
        lock_acquired = await redis.set(lock_key, "1", nx=True, ex=10)
        if not lock_acquired:
            raise BadRequestError("Registration in progress. Please retry in a moment.")

        try:
            confirmed_count = await self.repo.count_confirmed(event_id)
            if event.max_participants and confirmed_count >= event.max_participants:
                status = RegistrationStatus.WAITLISTED
            else:
                status = RegistrationStatus.CONFIRMED

            reg = await self.repo.create(
                event_id=event_id,
                user_id=actor.id,
                status=status,
                registered_at=now,
                confirmed_at=now if status == RegistrationStatus.CONFIRMED else None,
            )
        finally:
            await redis.delete(lock_key)

        if status == RegistrationStatus.CONFIRMED:
            qr_token = self._make_qr_token(str(reg.id), str(event_id))
            self._write_qr_png(str(reg.id), qr_token)
            reg = await self.repo.update(reg, qr_token=qr_token)
            if self.notif_repo:
                await self.notif_repo.create(
                    user_id=actor.id,
                    type="REGISTRATION_CONFIRMED",
                    title=f"Registration confirmed: {event.title}",
                    body="Your registration is confirmed. Use your QR code to check in at the event.",
                    metadata_={"event_id": str(event_id)},
                )

        return reg

    async def admin_delete(self, reg_id: UUID) -> None:
        """Hard-delete a registration (admin only). Promotes waitlisted if applicable."""
        reg = await self.repo.get(reg_id)
        if not reg:
            raise NotFoundError("Registration", reg_id)

        event_id = reg.event_id
        was_confirmed = reg.status == RegistrationStatus.CONFIRMED

        await self.repo.delete(reg)

        if was_confirmed:
            waitlisted = await self.repo.first_waitlisted(event_id)
            if waitlisted:
                now = datetime.now(timezone.utc)
                qr_token = self._make_qr_token(str(waitlisted.id), str(event_id))
                self._write_qr_png(str(waitlisted.id), qr_token)
                await self.repo.update(
                    waitlisted,
                    status=RegistrationStatus.CONFIRMED,
                    confirmed_at=now,
                    qr_token=qr_token,
                )
                if self.notif_repo:
                    await self.notif_repo.create(
                        user_id=waitlisted.user_id,
                        type="REGISTRATION_CONFIRMED",
                        title="You've been moved off the waitlist!",
                        body="A spot opened up and your registration is now confirmed.",
                        metadata_={"event_id": str(event_id)},
                    )

    async def cancel(self, reg_id: UUID, actor: User) -> Registration:
        reg = await self.repo.get(reg_id)
        if not reg:
            raise NotFoundError("Registration", reg_id)
        if reg.user_id != actor.id:
            raise BadRequestError("Not your registration")
        if reg.status == RegistrationStatus.CANCELLED:
            raise BadRequestError("Already cancelled")

        reg = await self.repo.update(reg, status=RegistrationStatus.CANCELLED, qr_token=None)

        # Promote first waitlisted participant
        waitlisted = await self.repo.first_waitlisted(reg.event_id)
        if waitlisted:
            now = datetime.now(timezone.utc)
            qr_token = self._make_qr_token(str(waitlisted.id), str(reg.event_id))
            self._write_qr_png(str(waitlisted.id), qr_token)
            await self.repo.update(
                waitlisted,
                status=RegistrationStatus.CONFIRMED,
                confirmed_at=now,
                qr_token=qr_token,
            )
            if self.notif_repo:
                await self.notif_repo.create(
                    user_id=waitlisted.user_id,
                    type="REGISTRATION_CONFIRMED",
                    title="You've been moved off the waitlist!",
                    body="A spot opened up and your registration is now confirmed. Check your QR code.",
                    metadata_={"event_id": str(reg.event_id)},
                )

        return reg

    async def get_qr_image_path(self, reg_id: UUID, actor: User) -> str:
        """Return the filesystem path to the QR PNG for direct streaming."""
        reg = await self.repo.get(reg_id)
        if not reg:
            raise NotFoundError("Registration", reg_id)
        if reg.user_id != actor.id:
            raise BadRequestError("Not your registration")
        if not reg.qr_token:
            raise BadRequestError("QR not available — registration not confirmed")

        png_path = Path(settings.LOCAL_STORAGE_PATH) / "qr" / f"{reg_id}.png"
        if not png_path.exists():
            # Regenerate if file was lost
            self._write_qr_png(str(reg_id), reg.qr_token)
        return str(png_path)

    async def list_by_event(self, event_id: UUID, skip: int, limit: int) -> list[Registration]:
        return await self.repo.list_by_event(event_id, skip, limit)

    async def list_by_event_enriched(self, event_id: UUID) -> list[dict]:
        return await self.repo.list_by_event_enriched(event_id)

    async def my_registrations(self, actor: User) -> list[Registration]:
        return await self.repo.list_by_user(actor.id)

    async def my_registrations_enriched(self, actor: User) -> list[dict]:
        return await self.repo.list_by_user_enriched(actor.id)
