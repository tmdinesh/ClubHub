from __future__ import annotations

import csv
import io
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.attendance.models import AttendanceRecord, Checkpoint
from app.modules.auth.models import User
from app.modules.events.models import Club, Event
from app.modules.feedback.models import FeedbackAnswer, NpsScore
from app.modules.finance.models import Expense, EventBudget, EventWinner
from app.modules.registration.models import Registration
from app.modules.teams.models import Team, TeamMember
from app.shared.enums import EventStatus, RegistrationStatus


class AnalyticsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def event_analytics(self, event_id: UUID) -> dict:
        # Registrations
        reg_total = await self._count(Registration, Registration.event_id == event_id)
        reg_confirmed = await self._count(
            Registration,
            Registration.event_id == event_id,
            Registration.status == RegistrationStatus.CONFIRMED,
        )

        # Attendance
        present = (
            await self.db.execute(
                select(func.count(AttendanceRecord.id))
                .join(Checkpoint, AttendanceRecord.checkpoint_id == Checkpoint.id)
                .where(Checkpoint.event_id == event_id, AttendanceRecord.is_duplicate == False)
            )
        ).scalar_one()
        attendance_rate = round(present / reg_confirmed, 4) if reg_confirmed else 0

        # Teams
        team_total = await self._count(Team, Team.event_id == event_id)
        member_count_result = (
            await self.db.execute(
                select(func.count(TeamMember.id))
                .join(Team, TeamMember.team_id == Team.id)
                .where(Team.event_id == event_id)
            )
        ).scalar_one()
        avg_size = round(member_count_result / team_total, 2) if team_total else 0

        # Finance
        budget_result = (
            await self.db.execute(select(EventBudget).where(EventBudget.event_id == event_id))
        ).scalar_one_or_none()
        budget = float(budget_result.total_budget) if budget_result else 0
        spent_result = (
            await self.db.execute(
                select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.event_id == event_id)
            )
        ).scalar_one()
        spent = float(spent_result)
        utilization = round(spent / budget, 4) if budget else 0

        # NPS
        nps_scores = (
            await self.db.execute(select(NpsScore).where(NpsScore.event_id == event_id))
        ).scalars().all()
        nps_val = None
        if nps_scores:
            total_n = len(nps_scores)
            promoters = sum(1 for s in nps_scores if s.score >= 9)
            detractors = sum(1 for s in nps_scores if s.score <= 6)
            nps_val = round(((promoters - detractors) / total_n) * 100, 1)

        return {
            "registrations": {"total": reg_total, "confirmed": reg_confirmed},
            "attendance": {"present": present, "rate": attendance_rate},
            "teams": {"total": team_total, "avg_size": avg_size},
            "feedback": {"nps": nps_val},
            "finance": {"budget": budget, "spent": spent, "utilization": utilization},
        }

    async def club_analytics(self, club_id: UUID) -> dict:
        events = (
            await self.db.execute(
                select(func.count(Event.id)).where(Event.organizer_club_id == club_id, Event.is_deleted == False)
            )
        ).scalar_one()
        return {"club_id": str(club_id), "total_events": events}

    async def all_clubs_analytics(self) -> list[dict]:
        clubs = (await self.db.execute(select(Club).where(Club.is_active == True).order_by(Club.name))).scalars().all()

        result = []
        for club in clubs:
            total_events = (
                await self.db.execute(
                    select(func.count(Event.id)).where(Event.organizer_club_id == club.id, Event.is_deleted == False)
                )
            ).scalar_one()

            published_events = (
                await self.db.execute(
                    select(func.count(Event.id)).where(
                        Event.organizer_club_id == club.id,
                        Event.is_deleted == False,
                        Event.status.in_([EventStatus.PUBLISHED, EventStatus.COMPLETED]),
                    )
                )
            ).scalar_one()

            total_registrations = (
                await self.db.execute(
                    select(func.count(Registration.id))
                    .join(Event, Registration.event_id == Event.id)
                    .where(Event.organizer_club_id == club.id, Event.is_deleted == False)
                )
            ).scalar_one()

            event_rows = (
                await self.db.execute(
                    select(Event)
                    .where(Event.organizer_club_id == club.id, Event.is_deleted == False)
                    .order_by(Event.start_datetime.desc().nullslast())
                )
            ).scalars().all()

            events_list = [
                {
                    "id": str(e.id),
                    "title": e.title,
                    "status": e.status.value if hasattr(e.status, "value") else e.status,
                    "start_datetime": e.start_datetime.isoformat() if e.start_datetime else None,
                    "category": e.category,
                }
                for e in event_rows
            ]

            result.append({
                "club_id": str(club.id),
                "club_name": club.name,
                "department": club.department,
                "total_events": total_events,
                "published_events": published_events,
                "total_registrations": total_registrations,
                "events": events_list,
            })

        return result

    async def platform_analytics(self) -> dict:
        total_events = (await self.db.execute(select(func.count(Event.id)).where(Event.is_deleted == False))).scalar_one()
        total_users = (await self.db.execute(select(func.count(User.id)))).scalar_one()
        total_registrations = (await self.db.execute(select(func.count(Registration.id)))).scalar_one()
        return {
            "total_events": total_events,
            "total_users": total_users,
            "total_registrations": total_registrations,
        }

    async def _count(self, model, *conditions) -> int:
        q = select(func.count()).select_from(model)
        for cond in conditions:
            q = q.where(cond)
        return (await self.db.execute(q)).scalar_one()

    async def winners_bank_export(self, from_date: date, to_date: date) -> str:
        from datetime import datetime, timezone
        from_dt = datetime(from_date.year, from_date.month, from_date.day, 0, 0, 0, tzinfo=timezone.utc)
        to_dt = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)

        q = (
            select(
                Event.title.label("event"),
                EventWinner.position,
                EventWinner.prize_amount,
                User.name.label("participant_name"),
                User.email.label("participant_email"),
                User.roll_number,
                User.bank_account_name,
                User.bank_account_number,
                User.bank_ifsc,
            )
            .join(Event, EventWinner.event_id == Event.id)
            .join(User, EventWinner.user_id == User.id)
            .where(
                Event.is_deleted == False,
                Event.start_datetime >= from_dt,
                Event.start_datetime <= to_dt,
            )
            .order_by(Event.start_datetime, Event.title, EventWinner.position)
        )
        rows = (await self.db.execute(q)).all()

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "Event", "Position", "Participant Name", "Email",
            "Roll Number", "Prize Amount (₹)",
            "Bank Account Name", "Account Number", "IFSC Code",
        ])
        for r in rows:
            writer.writerow([
                r.event,
                r.position,
                r.participant_name,
                r.participant_email,
                r.roll_number or "",
                float(r.prize_amount) if r.prize_amount else "",
                r.bank_account_name or "",
                r.bank_account_number or "",
                r.bank_ifsc or "",
            ])
        return buf.getvalue()
