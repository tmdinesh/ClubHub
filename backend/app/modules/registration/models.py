from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base
from app.shared.enums import RegistrationStatus


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_registration_event_user"),
        UniqueConstraint("qr_token", name="uq_registration_qr_token"),
        Index("ix_registrations_event_id", "event_id"),
        Index("ix_registrations_user_id", "user_id"),
        Index("ix_registrations_team_id", "team_id"),
        Index("ix_registrations_status", "status"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="RESTRICT"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL")
    )
    status: Mapped[RegistrationStatus] = mapped_column(
        String(16), nullable=False, default=RegistrationStatus.PENDING
    )
    qr_token: Mapped[str | None] = mapped_column(String(1024), unique=True)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
