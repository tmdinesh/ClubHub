from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.events.models import Club, Event
from app.modules.registration.models import Registration
from app.shared.enums import RegistrationStatus


class RegistrationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, reg_id: UUID) -> Registration | None:
        result = await self.db.execute(select(Registration).where(Registration.id == reg_id))
        return result.scalar_one_or_none()

    async def set_team(self, event_id: UUID, user_id: UUID, team_id: UUID) -> None:
        """Update the registration's team_id when a user joins or creates a team."""
        reg = await self.get_by_event_user(event_id, user_id)
        if reg:
            reg.team_id = team_id
            await self.db.flush()

    async def get_by_event_user(self, event_id: UUID, user_id: UUID) -> Registration | None:
        result = await self.db.execute(
            select(Registration).where(
                Registration.event_id == event_id, Registration.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def list_by_event(
        self, event_id: UUID, skip: int = 0, limit: int = 100
    ) -> list[Registration]:
        result = await self.db.execute(
            select(Registration)
            .where(Registration.event_id == event_id)
            .offset(skip)
            .limit(limit)
            .order_by(Registration.registered_at)
        )
        return list(result.scalars().all())

    async def list_by_event_enriched(self, event_id: UUID) -> list[dict]:
        """Return registrations with participant name, email, team name, team lead, and check-in status."""
        from app.modules.attendance.models import AttendanceRecord
        from app.modules.auth.models import User as UserModel
        from app.modules.teams.models import Team
        checked_in_subq = (
            select(AttendanceRecord.registration_id)
            .where(AttendanceRecord.registration_id == Registration.id)
            .correlate(Registration)
            .exists()
            .label("is_checked_in")
        )
        q = (
            select(
                Registration,
                UserModel.name.label("participant_name"),
                UserModel.email.label("participant_email"),
                UserModel.roll_number.label("participant_roll_number"),
                UserModel.bank_account_name.label("bank_account_name"),
                UserModel.bank_account_number.label("bank_account_number"),
                UserModel.bank_ifsc.label("bank_ifsc"),
                Team.name.label("team_name"),
                Team.lead_id.label("team_lead_id"),
                checked_in_subq,
            )
            .join(UserModel, Registration.user_id == UserModel.id)
            .outerjoin(Team, Registration.team_id == Team.id)
            .where(Registration.event_id == event_id)
            .order_by(Registration.registered_at)
        )
        rows = await self.db.execute(q)
        result = []
        for row in rows:
            reg: Registration = row[0]
            result.append({
                "id": reg.id,
                "event_id": reg.event_id,
                "user_id": reg.user_id,
                "status": reg.status,
                "registered_at": reg.registered_at,
                "confirmed_at": reg.confirmed_at,
                "created_at": reg.created_at,
                "participant_name": row.participant_name,
                "participant_email": row.participant_email,
                "participant_roll_number": row.participant_roll_number,
                "bank_account_name": row.bank_account_name,
                "bank_account_number": row.bank_account_number,
                "bank_ifsc": row.bank_ifsc,
                "team_id": reg.team_id,
                "team_name": row.team_name,
                "team_lead_id": row.team_lead_id,
                "is_checked_in": bool(row.is_checked_in),
            })
        return result

    async def list_by_user(self, user_id: UUID) -> list[Registration]:
        result = await self.db.execute(
            select(Registration).where(Registration.user_id == user_id)
        )
        return list(result.scalars().all())

    async def list_by_user_enriched(self, user_id: UUID) -> list[dict]:
        """Return registrations joined with event title, slug, start_datetime, club name, and team settings."""
        q = (
            select(
                Registration,
                Event.title.label("event_title"),
                Event.slug.label("event_slug"),
                Event.start_datetime.label("event_start_datetime"),
                Event.is_team_event.label("is_team_event"),
                Event.team_min_size.label("team_min_size"),
                Event.team_max_size.label("team_max_size"),
                Club.name.label("club_name"),
            )
            .join(Event, Registration.event_id == Event.id)
            .join(Club, Event.organizer_club_id == Club.id)
            .where(Registration.user_id == user_id)
            .order_by(Event.start_datetime.asc().nullslast())
        )
        rows = await self.db.execute(q)
        result = []
        for row in rows:
            reg: Registration = row[0]
            result.append({
                "id": reg.id,
                "event_id": reg.event_id,
                "user_id": reg.user_id,
                "team_id": reg.team_id,
                "status": reg.status,
                "registered_at": reg.registered_at,
                "confirmed_at": reg.confirmed_at,
                "created_at": reg.created_at,
                "event_title": row.event_title,
                "event_slug": row.event_slug,
                "event_start_datetime": row.event_start_datetime,
                "club_name": row.club_name,
                "is_team_event": row.is_team_event,
                "team_min_size": row.team_min_size,
                "team_max_size": row.team_max_size,
            })
        return result

    async def list_confirmed_with_users(self, event_id: UUID) -> list[dict]:
        """Return confirmed registrations with user name + email for notification."""
        from app.modules.auth.models import User as UserModel
        q = (
            select(UserModel.id, UserModel.name, UserModel.email)
            .join(Registration, Registration.user_id == UserModel.id)
            .where(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.CONFIRMED,
            )
        )
        rows = await self.db.execute(q)
        return [{"user_id": str(r.id), "name": r.name, "email": r.email} for r in rows]

    async def count_confirmed(self, event_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count()).where(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.CONFIRMED,
            )
        )
        return result.scalar_one()

    async def first_waitlisted(self, event_id: UUID) -> Registration | None:
        result = await self.db.execute(
            select(Registration)
            .where(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.WAITLISTED,
            )
            .order_by(Registration.registered_at)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> Registration:
        reg = Registration(**kwargs)
        self.db.add(reg)
        await self.db.flush()
        return reg

    async def update(self, reg: Registration, **kwargs) -> Registration:
        for k, v in kwargs.items():
            setattr(reg, k, v)
        await self.db.flush()
        return reg

    async def delete(self, reg: Registration) -> None:
        await self.db.delete(reg)
        await self.db.flush()
