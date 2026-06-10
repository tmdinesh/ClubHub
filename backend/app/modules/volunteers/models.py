from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base
from app.shared.enums import VolunteerStatus


class VolunteerPosition(Base):
    __tablename__ = "volunteer_positions"
    __table_args__ = (Index("ix_volunteer_positions_event_id", "event_id"),)

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    slots: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    applications: Mapped[list["VolunteerApplication"]] = relationship(
        back_populates="position"
    )


class VolunteerApplication(Base):
    __tablename__ = "volunteer_applications"
    __table_args__ = (
        Index("ix_volunteer_applications_position_id", "position_id"),
        Index("ix_volunteer_applications_user_id", "user_id"),
    )

    position_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("volunteer_positions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[VolunteerStatus] = mapped_column(
        String(16), nullable=False, default=VolunteerStatus.APPLIED
    )
    assigned_at: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )  # reuses UUID type for timestamp-like tracking via FK pattern; stored as UTC epoch

    position: Mapped["VolunteerPosition"] = relationship(back_populates="applications")
