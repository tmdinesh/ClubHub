from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.shared.enums import EventStatus, EventType


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    agenda: str | None = None
    rules: str | None = None
    venue: str | None = None
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    registration_start: datetime | None = None
    registration_end: datetime | None = None
    category: str | None = None
    event_type: EventType = EventType.INTERNAL
    external_event_url: str | None = None
    organizer_club_id: UUID | None = None
    faculty_advisor_id: UUID | None = None
    max_participants: int | None = None
    banner_url: str | None = None
    is_team_event: bool = False
    team_min_size: int = 2
    team_max_size: int = 5


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    agenda: str | None = None
    rules: str | None = None
    venue: str | None = None
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    registration_start: datetime | None = None
    registration_end: datetime | None = None
    category: str | None = None
    external_event_url: str | None = None
    max_participants: int | None = None
    banner_url: str | None = None


class EventOut(BaseModel):
    id: UUID
    title: str
    slug: str
    description: str | None
    venue: str | None
    start_datetime: datetime | None
    end_datetime: datetime | None
    registration_start: datetime | None
    registration_end: datetime | None
    category: str | None
    event_type: EventType
    status: EventStatus
    max_participants: int | None
    banner_url: str | None
    organizer_club_id: UUID
    faculty_advisor_id: UUID | None
    created_at: datetime
    club_name: str = ""
    is_team_event: bool = False
    team_min_size: int = 2
    team_max_size: int = 5

    model_config = {"from_attributes": True}


class RejectBody(BaseModel):
    comment: str


class OrganizerAssign(BaseModel):
    user_id: UUID
    role: str
    permissions: dict | None = None


class ClubCreate(BaseModel):
    name: str
    description: str | None = None
    logo_url: str | None = None
    department: str | None = None


class ClubOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    logo_url: str | None
    department: str | None
    is_active: bool
    faculty_advisor_id: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
