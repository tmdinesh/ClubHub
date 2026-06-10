from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class UserRegistered:
    type: str = "USER_REGISTERED"
    user_id: str = ""
    email: str = ""
    name: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "user_id": self.user_id, "email": self.email, "name": self.name}


@dataclass
class UserLoggedIn:
    type: str = "USER_LOGGED_IN"
    user_id: str = ""
    email: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "user_id": self.user_id, "email": self.email}
