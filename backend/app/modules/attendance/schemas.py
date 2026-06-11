from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ScanRequest(BaseModel):
    qr_token: str
    checkpoint_id: UUID


class ScanResponse(BaseModel):
    is_duplicate: bool
    record_id: str | None = None
    message: str | None = None
    participant_name: str | None = None
    roll_number: str | None = None
    team_name: str | None = None


class RollLookupRequest(BaseModel):
    roll_number: str
    event_id: UUID


class RollLookupResponse(BaseModel):
    reg_id: str
    participant_name: str
    roll_number: str
    email: str
    team_name: str | None = None
    status: str


class RollScanRequest(BaseModel):
    roll_number: str
    event_id: UUID
    checkpoint_id: UUID


class AttendanceDashboard(BaseModel):
    registered: int
    present: int
    absent: int
    rate: float


class CheckpointCreate(BaseModel):
    name: str
    description: str | None = None
    order: int = 0


class CheckpointOut(BaseModel):
    id: UUID
    event_id: UUID
    name: str
    description: str | None
    order: int

    model_config = {"from_attributes": True}
