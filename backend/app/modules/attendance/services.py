from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import get_redis_client
from app.modules.attendance.models import AttendanceRecord, Checkpoint
from app.modules.attendance.repos import AttendanceRepository
from app.modules.auth.models import User
from app.modules.registration.models import Registration
from app.modules.registration.repos import RegistrationRepository
from app.shared.enums import RegistrationStatus
from app.shared.exceptions import BadRequestError, NotFoundError, UnauthorizedError


class AttendanceService:
    def __init__(self, repo: AttendanceRepository, reg_repo: RegistrationRepository) -> None:
        self.repo = repo
        self.reg_repo = reg_repo

    async def _assert_event_active(self, event_id: UUID) -> None:
        from app.modules.events.models import Event
        from sqlalchemy import select
        result = await self.repo.db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()
        if event:
            if event.status in ("COMPLETED", "CANCELLED", "ARCHIVED"):
                raise BadRequestError("This event has ended. Attendance marking is no longer allowed.")
            if event.end_datetime:
                # Block from the start of the next calendar day after end_datetime
                end_date = event.end_datetime.astimezone(timezone.utc).date()
                next_day = datetime(end_date.year, end_date.month, end_date.day, tzinfo=timezone.utc) + timedelta(days=1)
                if datetime.now(timezone.utc) >= next_day:
                    raise BadRequestError("This event has ended. Attendance marking is no longer allowed.")

    async def _mark_attended(self, reg_id: UUID) -> None:
        """Flip registration status CONFIRMED → ATTENDED on first successful scan."""
        if self.reg_repo:
            reg = await self.reg_repo.get(reg_id)
            if reg and reg.status == RegistrationStatus.CONFIRMED:
                await self.reg_repo.update(reg, status=RegistrationStatus.ATTENDED)

    async def scan(self, qr_token: str, checkpoint_id: UUID, scanner: User) -> dict:
        try:
            payload = jwt.decode(qr_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        except JWTError:
            raise UnauthorizedError("Invalid QR token")

        reg_id = payload.get("reg_id")
        if not reg_id:
            raise BadRequestError("Malformed QR token")

        reg = await self.reg_repo.get(UUID(reg_id))
        if not reg:
            raise NotFoundError("Registration", reg_id)
        if reg.status not in (RegistrationStatus.CONFIRMED, RegistrationStatus.ATTENDED):
            raise BadRequestError("Registration is not confirmed")

        await self._assert_event_active(reg.event_id)

        cp = await self.repo.get_checkpoint(checkpoint_id)
        if not cp:
            raise NotFoundError("Checkpoint", checkpoint_id)

        # Fetch participant info for display
        participant_info = await self.repo.get_participant_info(UUID(reg_id))

        redis = get_redis_client()
        lock_key = f"attendance_lock:{reg_id}:{checkpoint_id}"
        acquired = await redis.set(lock_key, "1", nx=True, ex=5)

        if not acquired:
            return {
                "is_duplicate": True,
                "message": "Scan in progress",
                **participant_info,
            }

        try:
            existing = await self.repo.existing_record(UUID(reg_id), checkpoint_id)
            if existing:
                return {"is_duplicate": True, "record_id": str(existing.id), **participant_info}

            record = await self.repo.create_record(
                registration_id=UUID(reg_id),
                checkpoint_id=checkpoint_id,
                scanned_at=datetime.now(timezone.utc),
                scanned_by=scanner.id,
                is_duplicate=False,
            )
            await self._mark_attended(UUID(reg_id))
            return {"is_duplicate": False, "record_id": str(record.id), **participant_info}
        finally:
            await redis.delete(lock_key)

    async def lookup_by_roll(self, roll_number: str, event_id: UUID) -> dict:
        row = await self.repo.get_registration_by_roll(event_id, roll_number.strip().upper())
        if not row:
            raise NotFoundError("Participant with roll number", roll_number)
        return row

    async def scan_by_roll(self, roll_number: str, event_id: UUID, checkpoint_id: UUID, scanner: User) -> dict:
        row = await self.repo.get_registration_by_roll(event_id, roll_number.strip().upper())
        if not row:
            raise NotFoundError("Participant with roll number", roll_number)

        from app.shared.enums import RegistrationStatus as RS
        if row["status"] not in (RS.CONFIRMED, RS.ATTENDED):
            raise BadRequestError("Registration is not confirmed")

        await self._assert_event_active(event_id)

        cp = await self.repo.get_checkpoint(checkpoint_id)
        if not cp:
            raise NotFoundError("Checkpoint", checkpoint_id)

        reg_id = UUID(row["reg_id"])
        participant_info = {
            "participant_name": row["participant_name"],
            "roll_number": row["roll_number"],
            "team_name": row["team_name"],
        }

        redis = get_redis_client()
        lock_key = f"attendance_lock:{reg_id}:{checkpoint_id}"
        acquired = await redis.set(lock_key, "1", nx=True, ex=5)

        if not acquired:
            return {"is_duplicate": True, "message": "Scan in progress", **participant_info}

        try:
            existing = await self.repo.existing_record(reg_id, checkpoint_id)
            if existing:
                return {"is_duplicate": True, "record_id": str(existing.id), **participant_info}

            record = await self.repo.create_record(
                registration_id=reg_id,
                checkpoint_id=checkpoint_id,
                scanned_at=datetime.now(timezone.utc),
                scanned_by=scanner.id,
                is_duplicate=False,
            )
            await self._mark_attended(reg_id)
            return {"is_duplicate": False, "record_id": str(record.id), **participant_info}
        finally:
            await redis.delete(lock_key)

    async def list_present_users(self, event_id: UUID) -> list[dict]:
        return await self.repo.list_present_users(event_id)

    async def get_dashboard(self, event_id: UUID) -> dict:
        registered = await self.repo.count_registered(event_id)
        present = await self.repo.count_present(event_id)
        return {
            "registered": registered,
            "present": present,
            "absent": registered - present,
            "rate": round(present / registered, 4) if registered else 0,
        }

    async def get_checkpoint_stats(self, event_id: UUID, checkpoint_id: UUID) -> dict:
        cp = await self.repo.get_checkpoint(checkpoint_id)
        if not cp:
            raise NotFoundError("Checkpoint", checkpoint_id)
        records = await self.repo.list_records(event_id)
        cp_records = [r for r in records if r.checkpoint_id == checkpoint_id and not r.is_duplicate]
        return {"checkpoint_id": str(checkpoint_id), "name": cp.name, "scans": len(cp_records)}

    async def export_csv(self, event_id: UUID) -> str:
        records = await self.repo.list_records(event_id)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["registration_id", "checkpoint_id", "scanned_at", "scanned_by", "is_duplicate"])
        for r in records:
            writer.writerow([r.registration_id, r.checkpoint_id, r.scanned_at, r.scanned_by, r.is_duplicate])
        return output.getvalue()

    async def create_checkpoint(self, event_id: UUID, name: str, description: str | None, order: int) -> Checkpoint:
        return await self.repo.create_checkpoint(event_id=event_id, name=name, description=description, order=order)

    def generate_mass_qr(self, event_id: UUID, checkpoint_id: UUID, interval_seconds: int) -> dict:
        now = datetime.now(timezone.utc)
        exp = now + timedelta(seconds=interval_seconds)
        payload = {
            "type": "mass",
            "event_id": str(event_id),
            "checkpoint_id": str(checkpoint_id),
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }
        token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        return {"qr_token": token, "expires_at": exp, "interval_seconds": interval_seconds}

    async def mass_scan(self, qr_token: str, actor) -> dict:
        try:
            payload = jwt.decode(qr_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        except JWTError:
            raise UnauthorizedError("Invalid or expired mass QR token")

        if payload.get("type") != "mass":
            raise BadRequestError("Not a mass attendance token")

        event_id = UUID(payload["event_id"])
        checkpoint_id = UUID(payload["checkpoint_id"])

        await self._assert_event_active(event_id)

        reg = await self.reg_repo.get_by_event_user(event_id, actor.id)
        if not reg:
            raise BadRequestError("You are not registered for this event")
        if reg.status not in (RegistrationStatus.CONFIRMED, RegistrationStatus.ATTENDED):
            raise BadRequestError("Your registration is not confirmed")

        cp = await self.repo.get_checkpoint(checkpoint_id)
        if not cp:
            raise NotFoundError("Checkpoint", checkpoint_id)

        participant_info = await self.repo.get_participant_info(reg.id)

        redis = get_redis_client()
        lock_key = f"attendance_lock:{reg.id}:{checkpoint_id}"
        acquired = await redis.set(lock_key, "1", nx=True, ex=5)

        if not acquired:
            return {"is_duplicate": True, "message": "Scan in progress", **participant_info}

        try:
            existing = await self.repo.existing_record(reg.id, checkpoint_id)
            if existing:
                return {"is_duplicate": True, "record_id": str(existing.id), **participant_info}

            record = await self.repo.create_record(
                registration_id=reg.id,
                checkpoint_id=checkpoint_id,
                scanned_at=datetime.now(timezone.utc),
                scanned_by=actor.id,
                is_duplicate=False,
            )
            await self._mark_attended(reg.id)
            return {"is_duplicate": False, "record_id": str(record.id), **participant_info}
        finally:
            await redis.delete(lock_key)

