from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class TeamInvitationSent:
    type: str = "TEAM_INVITATION_SENT"
    team_id: str = ""
    email: str = ""
    token: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "team_id": self.team_id, "email": self.email, "token": self.token}


@dataclass
class TeamReady:
    type: str = "TEAM_READY"
    team_id: str = ""
    event_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "team_id": self.team_id, "event_id": self.event_id}
