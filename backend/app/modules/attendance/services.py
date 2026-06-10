from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from uuid import UUID

from jose import JWTError, jwt

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

    async def scan(self, qr_token: str, checkpoint_id: UUID, scanner: User) -> dict:
        # Decode and verify QR JWT
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
        if reg.status != RegistrationStatus.CONFIRMED:
            raise BadRequestError("Registration is not confirmed")

        cp = await self.repo.get_checkpoint(checkpoint_id)
        if not cp:
            raise NotFoundError("Checkpoint", checkpoint_id)

        # Redis lock: SETNX with 5s TTL to prevent race-condition duplicates
        redis = get_redis_client()
        lock_key = f"attendance_lock:{reg_id}:{checkpoint_id}"
        acquired = await redis.set(lock_key, "1", nx=True, ex=5)

        if not acquired:
            # Lock not acquired → concurrent scan in progress, treat as duplicate
            return {"is_duplicate": True, "message": "Scan in progress"}

        try:
            existing = await self.repo.existing_record(UUID(reg_id), checkpoint_id)
            if existing:
                return {"is_duplicate": True, "record_id": str(existing.id)}

            record = await self.repo.create_record(
                registration_id=UUID(reg_id),
                checkpoint_id=checkpoint_id,
                scanned_at=datetime.now(timezone.utc),
                scanned_by=scanner.id,
                is_duplicate=False,
            )
            return {"is_duplicate": False, "record_id": str(record.id)}
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
