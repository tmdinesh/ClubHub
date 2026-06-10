from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.certificates.models import Certificate, CertificateTemplate


class CertificateRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _with_event(self, q):
        return q.options(selectinload(Certificate.event))

    async def list_templates_by_event(self, event_id: UUID) -> list[CertificateTemplate]:
        result = await self.db.execute(
            select(CertificateTemplate).where(CertificateTemplate.event_id == event_id)
        )
        return list(result.scalars().all())

    async def get_template_by_event_type(
        self, event_id: UUID, cert_type
    ) -> CertificateTemplate | None:
        result = await self.db.execute(
            select(CertificateTemplate).where(
                CertificateTemplate.event_id == event_id,
                CertificateTemplate.certificate_type == cert_type,
            )
        )
        return result.scalar_one_or_none()

    async def get_template(self, template_id: UUID) -> CertificateTemplate | None:
        result = await self.db.execute(
            select(CertificateTemplate).where(CertificateTemplate.id == template_id)
        )
        return result.scalar_one_or_none()

    async def create_template(self, **kwargs) -> CertificateTemplate:
        t = CertificateTemplate(**kwargs)
        self.db.add(t)
        await self.db.flush()
        return t

    async def create_certificate(self, **kwargs) -> Certificate:
        kwargs.setdefault("issued_at", datetime.now(timezone.utc))
        cert = Certificate(**kwargs)
        self.db.add(cert)
        await self.db.flush()
        return cert

    async def list_by_event(self, event_id: UUID) -> list[Certificate]:
        result = await self.db.execute(
            self._with_event(select(Certificate).where(Certificate.event_id == event_id))
        )
        return list(result.scalars().all())

    async def list_by_event_enriched(self, event_id: UUID) -> list[dict]:
        from app.modules.auth.models import User
        q = (
            select(Certificate, User.name.label("recipient_name"))
            .join(User, Certificate.recipient_id == User.id)
            .options(selectinload(Certificate.event))
            .where(Certificate.event_id == event_id)
            .order_by(Certificate.issued_at.desc())
        )
        rows = await self.db.execute(q)
        result = []
        for cert, name in rows:
            result.append((cert, name))
        return result

    async def list_by_recipient(self, user_id: UUID) -> list[Certificate]:
        result = await self.db.execute(
            self._with_event(select(Certificate).where(Certificate.recipient_id == user_id))
        )
        return list(result.scalars().all())

    async def get_certificate(self, cert_id: UUID) -> Certificate | None:
        result = await self.db.execute(
            self._with_event(select(Certificate).where(Certificate.id == cert_id))
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, unique_code: str) -> Certificate | None:
        result = await self.db.execute(
            self._with_event(select(Certificate).where(Certificate.unique_code == unique_code))
        )
        return result.scalar_one_or_none()

    async def get_by_event_user_type(
        self, event_id: UUID, user_id: UUID, cert_type
    ) -> Certificate | None:
        from app.shared.enums import CertificateType
        result = await self.db.execute(
            self._with_event(select(Certificate).where(
                Certificate.event_id == event_id,
                Certificate.recipient_id == user_id,
                Certificate.certificate_type == cert_type,
            ))
        )
        return result.scalar_one_or_none()
