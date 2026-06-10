from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base


class EventAttendanceCred(Base):
    """
    Login credential set generated per-event for attendance takers.
    Club Admin generates up to 10 per event; each has a username/password pair.
    """
    __tablename__ = "event_attendance_creds"
    __table_args__ = (
        Index("ix_event_attendance_creds_event_id", "event_id"),
        Index("ix_event_attendance_creds_username", "username"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # bcrypt hash stored here
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
