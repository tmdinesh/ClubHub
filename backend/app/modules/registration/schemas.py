from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.shared.enums import RegistrationStatus


class RegistrationOut(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    team_id: UUID | None
    status: RegistrationStatus
    registered_at: datetime
    confirmed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RegistrationWithEventOut(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    team_id: UUID | None
    status: RegistrationStatus
    registered_at: datetime
    confirmed_at: datetime | None
    created_at: datetime
    # enriched event fields
    event_title: str
    event_slug: str
    event_start_datetime: datetime | None
    club_name: str
    is_team_event: bool = False
    team_min_size: int = 2
    team_max_size: int = 5

    model_config = {"from_attributes": False}


class RegistrationDetailOut(BaseModel):
    """Enriched registration for organiser/manager views — includes participant & team info."""
    id: UUID
    event_id: UUID
    user_id: UUID
    status: RegistrationStatus
    registered_at: datetime
    confirmed_at: datetime | None
    created_at: datetime
    participant_name: str
    participant_email: str
    team_id: UUID | None = None
    team_name: str | None = None
    team_lead_id: UUID | None = None
    is_checked_in: bool = False

    model_config = {"from_attributes": False}


class QRResponse(BaseModel):
    qr_url: str
