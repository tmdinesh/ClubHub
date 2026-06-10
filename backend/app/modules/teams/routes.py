from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.events.repos import EventRepository
from app.modules.registration.repos import RegistrationRepository
from app.modules.teams.repos import TeamRepository
from app.modules.teams.schemas import (
    InvitationOut, InviteRequest, JoinKeyRequest,
    TeamCreate, TeamMemberOut, TeamOut,
)
from app.modules.teams.services import TeamService

router = APIRouter(tags=["teams"])


def _svc(db: AsyncSession = Depends(get_db)) -> TeamService:
    return TeamService(TeamRepository(db), EventRepository(db), RegistrationRepository(db))


def _team_out(team, actor_id=None) -> TeamOut:
    """Populate TeamOut; hide join_key unless the requester is the team lead."""
    out = TeamOut.model_validate(team)
    if hasattr(team, "member_count"):
        out.member_count = team.member_count
    if out.join_key and actor_id and team.lead_id != actor_id:
        out.join_key = None   # mask key for non-leads
    return out


def _team_out_dict(d: dict, actor_id=None) -> TeamOut:
    """Build TeamOut from a dict (list_teams_with_count rows)."""
    out = TeamOut.model_validate(d)
    if d.get("join_key") and actor_id and d.get("lead_id") != actor_id:
        out.join_key = None
    return out


@router.post("/events/{event_id}/teams", response_model=TeamOut, status_code=201)
async def create_team(
    event_id: UUID,
    body: TeamCreate,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> TeamOut:
    team = await svc.create_team(
        event_id, body.name, body.min_size, body.max_size, body.is_public, actor
    )
    return _team_out(team, actor.id)


@router.get("/events/{event_id}/teams/admin", response_model=list[dict])
async def list_teams_admin(
    event_id: UUID,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[dict]:
    """Admin view: teams with members from team_members table (not registrations)."""
    return await svc.repo.list_teams_with_members(event_id)


@router.get("/events/{event_id}/teams", response_model=list[TeamOut])
async def list_teams(
    event_id: UUID,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[TeamOut]:
    rows = await svc.repo.list_teams_with_count(event_id)
    return [_team_out_dict(r, actor.id) for r in rows]


@router.get("/events/{event_id}/teams/me", response_model=list[TeamOut])
async def my_event_teams(
    event_id: UUID,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[TeamOut]:
    rows = await svc.my_teams(event_id, actor.id)
    return [_team_out_dict(r, actor.id) for r in rows]


@router.get("/teams/{team_id}", response_model=TeamOut)
async def get_team(
    team_id: UUID,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> TeamOut:
    team = await svc.get_team(team_id)
    return _team_out(team, actor.id)


@router.post("/teams/join-by-key", response_model=TeamMemberOut, status_code=201)
async def join_by_key_only(
    body: JoinKeyRequest,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> TeamMemberOut:
    """Join a private team using just the join key — no team ID required."""
    member = await svc.join_by_key_only(body.join_key, actor)
    return TeamMemberOut.model_validate(member)


@router.post("/teams/{team_id}/join", response_model=TeamMemberOut, status_code=201)
async def join_public_team(
    team_id: UUID,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> TeamMemberOut:
    """Join a public team directly — no key required."""
    member = await svc.join_public(team_id, actor)
    return TeamMemberOut.model_validate(member)


@router.post("/teams/{team_id}/join-key", response_model=TeamMemberOut, status_code=201)
async def join_private_team(
    team_id: UUID,
    body: JoinKeyRequest,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> TeamMemberOut:
    """Join a private team by presenting the join key."""
    member = await svc.join_by_key(team_id, body.join_key, actor)
    return TeamMemberOut.model_validate(member)


@router.post("/teams/{team_id}/invite", response_model=InvitationOut, status_code=201)
async def invite_member(
    team_id: UUID,
    body: InviteRequest,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> InvitationOut:
    inv = await svc.invite_member(team_id, body.email, actor)
    return InvitationOut.model_validate(inv)


@router.get("/teams/join/{token}", response_model=TeamMemberOut)
async def join_team_by_invite(
    token: str,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> TeamMemberOut:
    member = await svc.accept_invitation(token, actor)
    return TeamMemberOut.model_validate(member)


@router.get("/teams/{team_id}/members", response_model=list[dict])
async def list_team_members(
    team_id: UUID,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[dict]:
    await svc.get_team(team_id)  # 404 if not found
    return await svc.repo.list_members_with_users(team_id)


@router.delete("/teams/{team_id}/members/{user_id}", status_code=204, response_class=Response, response_model=None)
async def remove_member(
    team_id: UUID,
    user_id: UUID,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> None:
    await svc.remove_member(team_id, user_id, actor)


@router.post("/teams/{team_id}/submit", response_model=TeamOut)
async def submit_team(
    team_id: UUID,
    svc: TeamService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> TeamOut:
    team = await svc.submit_team(team_id, actor)
    return _team_out(team, actor.id)
