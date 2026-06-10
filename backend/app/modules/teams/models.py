from __future__ import annotations

import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base
from app.shared.enums import InvitationStatus, TeamStatus


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        Index("ix_teams_event_id", "event_id"),
        Index("ix_teams_lead_id", "lead_id"),
        Index("ix_teams_status", "status"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[TeamStatus] = mapped_column(
        String(16), nullable=False, default=TeamStatus.FORMING
    )
    max_size: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    min_size: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    join_key: Mapped[str | None] = mapped_column(String(16), nullable=True)

    members: Mapped[list["TeamMember"]] = relationship(back_populates="team")
    invitations: Mapped[list["TeamInvitation"]] = relationship(back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_members"),
        Index("ix_team_members_team_id", "team_id"),
        Index("ix_team_members_user_id", "user_id"),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(32), default="MEMBER", nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    team: Mapped["Team"] = relationship(back_populates="members")


class TeamInvitation(Base):
    __tablename__ = "team_invitations"
    __table_args__ = (
        UniqueConstraint("token", name="uq_team_invitation_token"),
        Index("ix_team_invitations_team_id", "team_id"),
        Index("ix_team_invitations_email", "email"),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    token: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    status: Mapped[InvitationStatus] = mapped_column(
        String(16), nullable=False, default=InvitationStatus.PENDING
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    team: Mapped["Team"] = relationship(back_populates="invitations")
