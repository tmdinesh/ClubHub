from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base
from app.shared.enums import ApprovalStatus, EventStatus, EventType


class Club(Base):
    __tablename__ = "clubs"
    __table_args__ = (Index("ix_clubs_department", "department"),)

    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(2048))
    department: Mapped[str | None] = mapped_column(String(128))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    faculty_advisor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    events: Mapped[list["Event"]] = relationship(back_populates="organizer_club")


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_events_slug"),
        Index("ix_events_status", "status"),
        Index("ix_events_organizer_club_id", "organizer_club_id"),
        Index("ix_events_faculty_advisor_id", "faculty_advisor_id"),
        Index("ix_events_start_datetime", "start_datetime"),
    )

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False)
    banner_url: Mapped[str | None] = mapped_column(String(2048))
    description: Mapped[str | None] = mapped_column(Text)
    agenda: Mapped[str | None] = mapped_column(Text)
    rules: Mapped[str | None] = mapped_column(Text)
    venue: Mapped[str | None] = mapped_column(String(512))
    start_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registration_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registration_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    category: Mapped[str | None] = mapped_column(String(64))
    event_type: Mapped[EventType] = mapped_column(
        String(16), nullable=False, default=EventType.INTERNAL
    )
    external_event_url: Mapped[str | None] = mapped_column(String(2048))
    organizer_club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="RESTRICT"), nullable=False
    )
    faculty_advisor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    visibility: Mapped[str] = mapped_column(String(16), default="PUBLIC", nullable=False)
    status: Mapped[EventStatus] = mapped_column(
        String(32), nullable=False, default=EventStatus.DRAFT
    )
    max_participants: Mapped[int | None] = mapped_column(Integer)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_team_event: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    team_min_size: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    team_max_size: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    organizer_club: Mapped["Club"] = relationship(back_populates="events")
    organizers: Mapped[list["EventOrganizer"]] = relationship(back_populates="event")
    approvals: Mapped[list["FacultyApproval"]] = relationship(back_populates="event")


class FacultyApproval(Base):
    __tablename__ = "faculty_approvals"
    __table_args__ = (
        Index("ix_faculty_approvals_event_id", "event_id"),
        Index("ix_faculty_approvals_faculty_id", "faculty_id"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[ApprovalStatus] = mapped_column(
        String(16), nullable=False, default=ApprovalStatus.PENDING
    )
    comment: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    event: Mapped["Event"] = relationship(back_populates="approvals")


class EventOrganizer(Base):
    __tablename__ = "event_organizers"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_event_organizers"),
        Index("ix_event_organizers_event_id", "event_id"),
        Index("ix_event_organizers_user_id", "user_id"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    permissions: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    event: Mapped["Event"] = relationship(back_populates="organizers")
