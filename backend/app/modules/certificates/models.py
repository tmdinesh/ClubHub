from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import Base
from app.shared.enums import CertificateType

if TYPE_CHECKING:
    from app.modules.events.models import Event


class CertificateTemplate(Base):
    __tablename__ = "certificate_templates"
    __table_args__ = (
        Index("ix_certificate_templates_event_id", "event_id"),
        Index("ix_certificate_templates_type", "certificate_type"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    certificate_type: Mapped[CertificateType] = mapped_column(
        String(16), nullable=False
    )
    template_file_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    placeholders: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    certificates: Mapped[list["Certificate"]] = relationship(back_populates="template")


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("unique_code", name="uq_certificate_code"),
        Index("ix_certificates_template_id", "template_id"),
        Index("ix_certificates_recipient_id", "recipient_id"),
        Index("ix_certificates_event_id", "event_id"),
        Index("ix_certificates_unique_code", "unique_code"),
    )

    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("certificate_templates.id", ondelete="RESTRICT"),
        nullable=True,
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="RESTRICT"), nullable=False
    )
    certificate_type: Mapped[CertificateType] = mapped_column(
        String(16), nullable=False
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    unique_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    pdf_url: Mapped[str | None] = mapped_column(String(2048))
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)

    template: Mapped["CertificateTemplate"] = relationship(back_populates="certificates")
    event: Mapped["Event"] = relationship(foreign_keys=[event_id], lazy="noload")
