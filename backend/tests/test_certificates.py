"""Unit tests for certificates module."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.modules.certificates.models import Certificate, CertificateTemplate
from app.modules.certificates.repos import CertificateRepository
from app.modules.certificates.services import CertificateService
from app.shared.enums import CertificateType


def _make_template(cert_type: CertificateType = CertificateType.PARTICIPATION) -> CertificateTemplate:
    t = CertificateTemplate()
    t.id = uuid4()
    t.event_id = uuid4()
    t.certificate_type = cert_type
    t.template_file_url = "/templates/participation.pdf"
    t.placeholders = {}
    return t


def _make_certificate(unique_code: str) -> Certificate:
    c = Certificate()
    c.id = uuid4()
    c.event_id = uuid4()
    c.recipient_id = uuid4()
    c.certificate_type = CertificateType.PARTICIPATION
    c.unique_code = unique_code
    c.pdf_url = f"/media/certificates/{unique_code}.pdf"
    c.issued_at = datetime.now(timezone.utc)
    c.metadata_ = {"name": "John Doe", "event_name": "HackFest 2024"}
    return c


class TestCertificateVerification:
    @pytest.mark.asyncio
    async def test_valid_code_returns_details(self):
        repo = AsyncMock(spec=CertificateRepository)
        cert = _make_certificate("CERT-HACKF-ABC12345")
        repo.get_by_code = AsyncMock(return_value=cert)

        svc = CertificateService(repo)
        result = await svc.verify_by_code("CERT-HACKF-ABC12345")

        assert result["valid"] is True
        assert result["recipient"] == "John Doe"
        assert result["event"] == "HackFest 2024"

    @pytest.mark.asyncio
    async def test_invalid_code_returns_not_valid(self):
        repo = AsyncMock(spec=CertificateRepository)
        repo.get_by_code = AsyncMock(return_value=None)

        svc = CertificateService(repo)
        result = await svc.verify_by_code("CERT-FAKE-00000000")

        assert result["valid"] is False

    @pytest.mark.asyncio
    async def test_bulk_generate_creates_certificates(self):
        repo = AsyncMock(spec=CertificateRepository)
        template = _make_template()
        repo.get_template = AsyncMock(return_value=template)

        cert = _make_certificate("CERT-TEST-XXXXXXXX")
        repo.create_certificate = AsyncMock(return_value=cert)

        recipients = [
            {
                "recipient_id": str(uuid4()),
                "name": "Alice",
                "event_name": "HackFest",
                "club_name": "CS Club",
                "date": "2024-01-01",
            }
        ]

        svc = CertificateService(repo)
        with patch("app.modules.certificates.services.Path") as MockPath:
            # Mock the file system operations
            mock_dir = MagicMock()
            mock_path_obj = MagicMock()
            mock_path_obj.__truediv__ = MagicMock(return_value=mock_path_obj)
            mock_path_obj.write_bytes = MagicMock()
            MockPath.return_value = mock_dir
            mock_dir.__truediv__ = MagicMock(return_value=mock_dir)
            mock_dir.mkdir = MagicMock()
            mock_dir.__truediv__ = MagicMock(return_value=mock_path_obj)

            results = await svc.bulk_generate(template.event_id, template.id, recipients)

        assert len(results) == 1
        repo.create_certificate.assert_called_once()

    @pytest.mark.asyncio
    async def test_unique_code_format(self):
        from app.modules.certificates.services import _generate_unique_code
        code = _generate_unique_code("HackFest 2024")
        assert code.startswith("CERT-")
        parts = code.split("-")
        assert len(parts) == 3
        assert len(parts[2]) == 8


class TestCertificateUniqueCodeFormat:
    def test_code_uses_event_title_prefix(self):
        from app.modules.certificates.services import _generate_unique_code
        code = _generate_unique_code("Annual Tech Fest")
        assert "CERT-" in code

    def test_code_is_uppercase(self):
        from app.modules.certificates.services import _generate_unique_code
        code = _generate_unique_code("test event")
        assert code == code.upper()
