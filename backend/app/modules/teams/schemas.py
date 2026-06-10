from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.shared.enums import InvitationStatus, TeamStatus


class TeamCreate(BaseModel):
    name: str
    min_size: int = 1
    max_size: int = 5
    is_public: bool = True


class InviteRequest(BaseModel):
    email: EmailStr


class JoinKeyRequest(BaseModel):
    join_key: str


class TeamOut(BaseModel):
    id: UUID
    event_id: UUID
    name: str
    lead_id: UUID
    status: TeamStatus
    max_size: int
    min_size: int
    is_public: bool = True
    join_key: str | None = None   # only populated when the requester is the lead
    created_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


class TeamMemberOut(BaseModel):
    id: UUID
    team_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class InvitationOut(BaseModel):
    id: UUID
    team_id: UUID
    email: str
    token: str
    status: InvitationStatus
    expires_at: datetime

    model_config = {"from_attributes": True}
