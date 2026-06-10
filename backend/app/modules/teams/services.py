from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from app.modules.auth.models import User
from app.modules.events.repos import EventRepository
from app.modules.registration.repos import RegistrationRepository
from app.modules.teams.models import Team, TeamInvitation, TeamMember
from app.modules.teams.repos import TeamRepository
from app.shared.enums import InvitationStatus, TeamStatus
from app.shared.exceptions import BadRequestError, ForbiddenError, NotFoundError


def _make_join_key() -> str:
    return secrets.token_urlsafe(6).upper()[:8]


class TeamService:
    def __init__(
        self,
        repo: TeamRepository,
        event_repo: EventRepository | None = None,
        reg_repo: RegistrationRepository | None = None,
    ) -> None:
        self.repo = repo
        self.event_repo = event_repo
        self.reg_repo = reg_repo

    async def _guard_one_team_per_event(self, event_id: UUID, user_id: UUID) -> None:
        """Raise if the user is already a member of any team in this event."""
        existing = await self.repo.get_user_team_in_event(event_id, user_id)
        if existing:
            raise BadRequestError(
                f"You are already a member of team '{existing.name}'. "
                "A participant can only be in one team per event."
            )

    async def _sync_registration_team(self, event_id: UUID, user_id: UUID, team_id: UUID) -> None:
        """Keep registrations.team_id in sync whenever a user joins a team."""
        if self.reg_repo:
            await self.reg_repo.set_team(event_id, user_id, team_id)

    async def create_team(
        self, event_id: UUID, name: str, min_size: int, max_size: int,
        is_public: bool, actor: User
    ) -> Team:
        if self.event_repo:
            event = await self.event_repo.get_event(event_id)
            if not event:
                raise NotFoundError("Event", event_id)
            if not event.is_team_event:
                raise BadRequestError("This event does not support teams")
            min_size = max(min_size, event.team_min_size)
            max_size = min(max_size, event.team_max_size)

        # Creator becomes the first member — enforce one-team-per-event here too
        await self._guard_one_team_per_event(event_id, actor.id)

        # Retry on join_key collision (partial unique index)
        for _ in range(5):
            join_key = None if is_public else _make_join_key()
            try:
                team = await self.repo.create_team(
                    event_id=event_id, name=name, lead_id=actor.id,
                    min_size=min_size, max_size=max_size,
                    is_public=is_public, join_key=join_key,
                )
                break
            except IntegrityError as exc:
                if "uq_teams_join_key" in str(exc.orig) or is_public:
                    raise
                await self.repo.db.rollback()
        else:
            raise BadRequestError("Could not generate a unique join key. Please try again.")
        # Auto-add the creator as a member
        await self.repo.add_member(team.id, actor.id, role="LEAD")
        await self._sync_registration_team(event_id, actor.id, team.id)
        return team

    async def get_team(self, team_id: UUID) -> Team:
        team = await self.repo.get_team(team_id)
        if not team:
            raise NotFoundError("Team", team_id)
        return team

    async def list_teams(self, event_id: UUID) -> list[Team]:
        return await self.repo.list_teams(event_id)

    async def my_teams(self, event_id: UUID, user_id: UUID) -> list[dict]:
        return await self.repo.list_teams_for_user(event_id, user_id)

    async def join_by_key_only(self, join_key: str, actor: User) -> TeamMember:
        """Join a private team by key alone — looks up the team from the key."""
        team = await self.repo.get_team_by_join_key(join_key)
        if not team:
            raise NotFoundError("Team", f"join key {join_key}")
        if team.is_public:
            raise BadRequestError("This team is public — join directly without a key.")
        if team.join_key != join_key.upper():
            raise BadRequestError("Invalid join key")
        await self._guard_one_team_per_event(team.event_id, actor.id)
        team = await self._check_joinable_locked(team.id)
        member = await self.repo.add_member(team.id, actor.id)
        await self._sync_registration_team(team.event_id, actor.id, team.id)
        await self._maybe_promote(team)
        return member

    async def _check_joinable_locked(self, team_id: UUID) -> Team:
        """Lock the team row, then verify it's still joinable. Returns the locked team."""
        team = await self.repo.get_team_for_update(team_id)
        if not team:
            raise NotFoundError("Team", team_id)
        if team.status in (TeamStatus.SUBMITTED, TeamStatus.DISQUALIFIED):
            raise BadRequestError("This team is no longer accepting members")
        count = await self.repo.count_members(team.id)
        if count >= team.max_size:
            raise BadRequestError(f"Team is full (max {team.max_size} members)")
        return team

    async def _check_joinable(self, team: Team) -> None:
        if team.status in (TeamStatus.SUBMITTED, TeamStatus.DISQUALIFIED):
            raise BadRequestError("This team is no longer accepting members")
        count = await self.repo.count_members(team.id)
        if count >= team.max_size:
            raise BadRequestError(f"Team is full (max {team.max_size} members)")

    async def join_public(self, team_id: UUID, actor: User) -> TeamMember:
        team = await self.get_team(team_id)
        if not team.is_public:
            raise BadRequestError("This team is private. Use the join key to join.")
        await self._guard_one_team_per_event(team.event_id, actor.id)
        team = await self._check_joinable_locked(team_id)
        member = await self.repo.add_member(team_id, actor.id)
        await self._sync_registration_team(team.event_id, actor.id, team_id)
        await self._maybe_promote(team)
        return member

    async def join_by_key(self, team_id: UUID, join_key: str, actor: User) -> TeamMember:
        team = await self.get_team(team_id)
        if team.is_public:
            raise BadRequestError("This team is public — join directly without a key.")
        if not team.join_key or team.join_key != join_key.upper():
            raise BadRequestError("Invalid join key")
        await self._guard_one_team_per_event(team.event_id, actor.id)
        team = await self._check_joinable_locked(team_id)
        member = await self.repo.add_member(team_id, actor.id)
        await self._sync_registration_team(team.event_id, actor.id, team_id)
        await self._maybe_promote(team)
        return member

    async def invite_member(self, team_id: UUID, email: str, actor: User) -> TeamInvitation:
        team = await self.get_team(team_id)
        if team.lead_id != actor.id:
            raise ForbiddenError("Only team lead can invite members")
        count = await self.repo.count_members(team_id)
        if count >= team.max_size:
            raise BadRequestError(f"Team is full (max {team.max_size} members)")
        return await self.repo.create_invitation(team_id, email)

    async def accept_invitation(self, token: str, actor: User) -> TeamMember:
        inv = await self.repo.get_invitation_by_token(token)
        if not inv:
            raise NotFoundError("Invitation", token)
        if inv.status != InvitationStatus.PENDING:
            raise BadRequestError("Invitation already used or expired")
        if inv.expires_at < datetime.now(timezone.utc):
            inv.status = InvitationStatus.EXPIRED
            raise BadRequestError("Invitation has expired")
        if actor.email != inv.email:
            raise ForbiddenError("This invitation was sent to a different email")

        team = await self.get_team(inv.team_id)
        await self._check_joinable(team)
        # One-team-per-event: check BEFORE accepting the invitation
        await self._guard_one_team_per_event(team.event_id, actor.id)

        inv.status = InvitationStatus.ACCEPTED
        member = await self.repo.add_member(inv.team_id, actor.id)
        await self._sync_registration_team(team.event_id, actor.id, inv.team_id)
        await self._maybe_promote(team)
        return member

    async def _maybe_promote(self, team: Team) -> None:
        """Transition FORMING → READY when min_size is reached."""
        count = await self.repo.count_members(team.id)
        if count >= team.min_size and team.status == TeamStatus.FORMING:
            await self.repo.update_team(team, status=TeamStatus.READY)

    async def remove_member(self, team_id: UUID, user_id: UUID, actor: User) -> None:
        team = await self.get_team(team_id)
        if team.lead_id != actor.id:
            raise ForbiddenError("Only team lead can remove members")
        await self.repo.remove_member(team_id, user_id)

    async def submit_team(self, team_id: UUID, actor: User) -> Team:
        team = await self.get_team(team_id)
        if team.lead_id != actor.id:
            raise ForbiddenError("Only team lead can submit the team")
        count = await self.repo.count_members(team_id)
        if count < team.min_size:
            raise BadRequestError(f"Need at least {team.min_size} members to submit")
        return await self.repo.update_team(team, status=TeamStatus.SUBMITTED)
