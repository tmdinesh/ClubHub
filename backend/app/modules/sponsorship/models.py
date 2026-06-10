from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base
from app.shared.enums import SponsorStatus


class Sponsor(Base):
    __tablename__ = "sponsors"
    __table_args__ = (Index("ix_sponsors_event_id", "event_id"),)

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(2048))
    amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    tier: Mapped[str | None] = mapped_column(String(32))
    contact_person: Mapped[str | None] = mapped_column(String(256))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[SponsorStatus] = mapped_column(
        String(16), nullable=False, default=SponsorStatus.PROSPECTIVE
    )
