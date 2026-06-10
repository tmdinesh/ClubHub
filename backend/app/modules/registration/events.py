from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class RegistrationConfirmed:
    type: str = "REGISTRATION_CONFIRMED"
    reg_id: str = ""
    user_id: str = ""
    event_id: str = ""
    qr_token: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "reg_id": self.reg_id,
            "user_id": self.user_id,
            "event_id": self.event_id,
            "qr_token": self.qr_token,
        }


@dataclass
class WaitlistPromoted:
    type: str = "WAITLIST_PROMOTED"
    reg_id: str = ""
    user_id: str = ""
    event_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "reg_id": self.reg_id, "user_id": self.user_id, "event_id": self.event_id}
