from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.shared.enums import CertificateType


class TemplateCreate(BaseModel):
    certificate_type: CertificateType
    template_file_url: str
    placeholders: dict | None = None


class BulkGenerateRequest(BaseModel):
    template_id: UUID
    recipients: list[dict[str, Any]]


class CertificateOut(BaseModel):
    id: UUID
    event_id: UUID
    recipient_id: UUID
    recipient_name: str = ""
    certificate_type: CertificateType
    unique_code: str
    pdf_url: str | None
    issued_at: datetime
    event_title: str = ""
    metadata_: dict | None = None

    model_config = {"from_attributes": True}


class VerifyResponse(BaseModel):
    valid: bool
    recipient: str | None = None
    event: str | None = None
    certificate_type: str | None = None
    issued_at: str | None = None
