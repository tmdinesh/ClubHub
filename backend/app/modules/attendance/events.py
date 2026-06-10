from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class AttendanceMarked:
    type: str = "ATTENDANCE_MARKED"
    reg_id: str = ""
    checkpoint_id: str = ""
    user_id: str = ""
    is_duplicate: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "reg_id": self.reg_id,
            "checkpoint_id": self.checkpoint_id,
            "user_id": self.user_id,
            "is_duplicate": self.is_duplicate,
        }
