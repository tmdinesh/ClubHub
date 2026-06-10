from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.teams.models import Team, TeamInvitation, TeamMember
from app.shared.enums import InvitationStatus, TeamStatus


class TeamRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_team(self, team_id: UUID) -> Team | None:
        result = await self.db.execute(select(Team).where(Team.id == team_id))
        return result.scalar_one_or_none()

    async def list_teams(self, event_id: UUID) -> list[Team]:
        result = await self.db.execute(select(Team).where(Team.event_id == event_id))
        return list(result.scalars().all())

    async def list_teams_with_count(self, event_id: UUID) -> list[dict]:
        """Return teams with live member count, is_public, and join_key."""
        q = (
            select(Team, func.count(TeamMember.id).label("member_count"))
            .outerjoin(TeamMember, TeamMember.team_id == Team.id)
            .where(Team.event_id == event_id)
            .group_by(Team.id)
            .order_by(Team.created_at.asc())
        )
        rows = await self.db.execute(q)
        result = []
        for row in rows:
            t: Team = row[0]
            result.append({
                "id": t.id, "event_id": t.event_id, "name": t.name,
                "lead_id": t.lead_id, "status": t.status,
                "max_size": t.max_size, "min_size": t.min_size,
                "is_public": t.is_public, "join_key": t.join_key,
                "created_at": t.created_at, "member_count": row.member_count,
            })
        return result

    async def list_teams_for_user(self, event_id: UUID, user_id: UUID) -> list[dict]:
        q = (
            select(Team, func.count(TeamMember.id).label("member_count"))
            .outerjoin(TeamMember, TeamMember.team_id == Team.id)
            .where(
                Team.event_id == event_id,
                Team.id.in_(
                    select(TeamMember.team_id).where(TeamMember.user_id == user_id)
                )
            )
            .group_by(Team.id)
            .order_by(Team.created_at.asc())
        )
        rows = await self.db.execute(q)
        result = []
        for row in rows:
            t: Team = row[0]
            result.append({
                "id": t.id, "event_id": t.event_id, "name": t.name,
                "lead_id": t.lead_id, "status": t.status,
                "max_size": t.max_size, "min_size": t.min_size,
                "is_public": t.is_public, "join_key": t.join_key,
                "created_at": t.created_at, "member_count": row.member_count,
            })
        return result

    async def list_teams_with_members(self, event_id: UUID) -> list[dict]:
        """Return teams with their members from team_members (authoritative source for admin view)."""
        q = (
            select(Team, TeamMember, User)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .join(User, User.id == TeamMember.user_id)
            .where(Team.event_id == event_id)
            .order_by(Team.name, User.name)
        )
        rows = await self.db.execute(q)
        teams: dict[str, dict] = {}
        for team, member, user in rows:
            tid = str(team.id)
            if tid not in teams:
                teams[tid] = {
                    "team_id": tid,
                    "team_name": team.name,
                    "lead_id": str(team.lead_id),
                    "status": team.status,
                    "members": [],
                }
            teams[tid]["members"].append({
                "user_id": str(user.id),
                "name": user.name,
                "email": user.email,
                "role": member.role,
            })
        return list(teams.values())

    async def get_team_by_join_key(self, join_key: str) -> Team | None:
        result = await self.db.execute(
            select(Team).where(Team.join_key == join_key.upper())
        )
        return result.scalar_one_or_none()

    async def get_user_team_in_event(self, event_id: UUID, user_id: UUID) -> Team | None:
        """Return the team this user already belongs to in this event (None if not in any)."""
        q = (
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(Team.event_id == event_id, TeamMember.user_id == user_id)
            .limit(1)
        )
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def get_team_for_update(self, team_id: UUID) -> Team | None:
        """SELECT ... FOR UPDATE — locks the team row to serialize concurrent joins."""
        from sqlalchemy.dialects.postgresql import insert as pg_insert  # noqa: F401 (unused, just test import)
        result = await self.db.execute(
            select(Team).where(Team.id == team_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def create_team(self, **kwargs) -> Team:
        team = Team(**kwargs)
        self.db.add(team)
        await self.db.flush()
        return team

    async def list_members_with_users(self, team_id: UUID) -> list[dict]:
        """Return team members with user name and email."""
        q = (
            select(TeamMember, User)
            .join(User, User.id == TeamMember.user_id)
            .where(TeamMember.team_id == team_id)
            .order_by(User.name)
        )
        rows = await self.db.execute(q)
        return [
            {
                "user_id": str(user.id),
                "name": user.name,
                "email": user.email,
                "role": member.role,
            }
            for member, user in rows
        ]

    async def get_member(self, team_id: UUID, user_id: UUID) -> TeamMember | None:
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id, TeamMember.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def add_member(self, team_id: UUID, user_id: UUID, role: str = "MEMBER") -> TeamMember:
        member = TeamMember(
            team_id=team_id, user_id=user_id, role=role,
            joined_at=datetime.now(timezone.utc),
        )
        self.db.add(member)
        await self.db.flush()
        return member

    async def remove_member(self, team_id: UUID, user_id: UUID) -> None:
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id, TeamMember.user_id == user_id
            )
        )
        member = result.scalar_one_or_none()
        if member:
            await self.db.delete(member)
            await self.db.flush()

    async def create_invitation(self, team_id: UUID, email: str) -> TeamInvitation:
        token = secrets.token_urlsafe(32)
        inv = TeamInvitation(
            team_id=team_id,
            email=email,
            token=token,
            status=InvitationStatus.PENDING,
            expires_at=datetime.now(timezone.utc) + timedelta(days=3),
        )
        self.db.add(inv)
        await self.db.flush()
        return inv

    async def get_invitation_by_token(self, token: str) -> TeamInvitation | None:
        result = await self.db.execute(
            select(TeamInvitation).where(TeamInvitation.token == token)
        )
        return result.scalar_one_or_none()

    async def count_members(self, team_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(TeamMember.id)).where(TeamMember.team_id == team_id)
        )
        return result.scalar_one()

    async def update_team(self, team: Team, **kwargs) -> Team:
        for k, v in kwargs.items():
            setattr(team, k, v)
        await self.db.flush()
        return team
