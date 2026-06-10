from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.attendance.models import AttendanceRecord, Checkpoint
from app.modules.auth.models import User
from app.modules.registration.models import Registration
from app.shared.enums import RegistrationStatus


class AttendanceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_checkpoint(self, cp_id: UUID) -> Checkpoint | None:
        result = await self.db.execute(select(Checkpoint).where(Checkpoint.id == cp_id))
        return result.scalar_one_or_none()

    async def list_checkpoints(self, event_id: UUID) -> list[Checkpoint]:
        result = await self.db.execute(
            select(Checkpoint).where(Checkpoint.event_id == event_id).order_by(Checkpoint.order)
        )
        return list(result.scalars().all())

    async def create_checkpoint(self, **kwargs) -> Checkpoint:
        cp = Checkpoint(**kwargs)
        self.db.add(cp)
        await self.db.flush()
        return cp

    async def existing_record(self, reg_id: UUID, cp_id: UUID) -> AttendanceRecord | None:
        result = await self.db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.registration_id == reg_id,
                AttendanceRecord.checkpoint_id == cp_id,
                AttendanceRecord.is_duplicate == False,
            )
        )
        return result.scalar_one_or_none()

    async def create_record(self, **kwargs) -> AttendanceRecord:
        rec = AttendanceRecord(**kwargs)
        self.db.add(rec)
        await self.db.flush()
        return rec

    async def count_registered(self, event_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(Registration.id)).where(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.CONFIRMED,
            )
        )
        return result.scalar_one()

    async def count_present(self, event_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(AttendanceRecord.id))
            .join(Checkpoint, AttendanceRecord.checkpoint_id == Checkpoint.id)
            .where(Checkpoint.event_id == event_id, AttendanceRecord.is_duplicate == False)
        )
        return result.scalar_one()

    async def list_records(self, event_id: UUID) -> list[AttendanceRecord]:
        result = await self.db.execute(
            select(AttendanceRecord)
            .join(Checkpoint, AttendanceRecord.checkpoint_id == Checkpoint.id)
            .where(Checkpoint.event_id == event_id)
        )
        return list(result.scalars().all())

    async def list_present_users(self, event_id: UUID) -> list[dict]:
        """Return distinct users who were scanned present at this event."""
        q = (
            select(User.id, User.name, User.email)
            .join(Registration, Registration.user_id == User.id)
            .join(AttendanceRecord, AttendanceRecord.registration_id == Registration.id)
            .join(Checkpoint, AttendanceRecord.checkpoint_id == Checkpoint.id)
            .where(
                Registration.event_id == event_id,
                Checkpoint.event_id == event_id,
                AttendanceRecord.is_duplicate == False,
            )
            .distinct(User.id)
        )
        rows = await self.db.execute(q)
        return [{"user_id": str(r.id), "name": r.name, "email": r.email} for r in rows]
