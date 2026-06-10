from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    body: str
    is_read: bool
    metadata_: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
