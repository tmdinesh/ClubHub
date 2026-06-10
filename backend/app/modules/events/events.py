from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EventCreated:
    type: str = "EVENT_CREATED"
    event_id: str = ""
    title: str = ""
    organizer_club_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "event_id": self.event_id, "title": self.title}


@dataclass
class EventStatusChanged:
    type: str = "EVENT_STATUS_CHANGED"
    event_id: str = ""
    old_status: str = ""
    new_status: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "event_id": self.event_id,
            "old_status": self.old_status,
            "new_status": self.new_status,
        }


@dataclass
class EventCompleted:
    type: str = "EVENT_COMPLETED"
    event_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "event_id": self.event_id}
