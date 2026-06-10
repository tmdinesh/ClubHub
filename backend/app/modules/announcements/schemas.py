from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    target_audience: dict[str, Any] | None = None
    channels: list[str] | None = None


class AnnouncementOut(BaseModel):
    id: UUID
    event_id: UUID
    title: str
    body: str
    sent_by: UUID
    sent_at: datetime | None
    channels: list[str] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
