from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base


class Checkpoint(Base):
    __tablename__ = "checkpoints"
    __table_args__ = (Index("ix_checkpoints_event_id", "event_id"),)

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="checkpoint")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        Index("ix_attendance_registration_id", "registration_id"),
        Index("ix_attendance_checkpoint_id", "checkpoint_id"),
        Index("ix_attendance_scanned_by", "scanned_by"),
    )

    registration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registrations.id", ondelete="CASCADE"),
        nullable=False,
    )
    checkpoint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("checkpoints.id", ondelete="CASCADE"),
        nullable=False,
    )
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scanned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    checkpoint: Mapped["Checkpoint"] = relationship(back_populates="records")
