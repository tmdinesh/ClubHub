from __future__ import annotations

import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.modules.certificates.models import Certificate, CertificateTemplate
from app.modules.certificates.repos import CertificateRepository
from app.shared.enums import CertificateType
from app.shared.exceptions import BadRequestError, NotFoundError

POSITION_LABELS = {
    "1st": "1st Place",
    "2nd": "2nd Place",
    "3rd": "3rd Place",
    "4th": "4th Place",
}


def _generate_unique_code(event_title: str) -> str:
    short = "".join(c.upper() for c in event_title if c.isalpha())[:6]
    return f"CERT-{short}-{uuid.uuid4().hex[:8].upper()}"


def _render_pdf_plain(context: dict[str, str]) -> bytes:
    """Generate a plain PDF without a template image."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    width, height = landscape(A4)

    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width / 2, height - 150, context.get("event_name", ""))
    c.setFont("Helvetica", 24)
    cert_type = context.get("certificate_type", "Participation")
    c.drawCentredString(width / 2, height - 220, f"Certificate of {cert_type}")
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2, height - 300, context.get("name", "Recipient"))
    c.setFont("Helvetica", 18)
    c.drawCentredString(width / 2, height - 370, context.get("club_name", ""))
    c.drawCentredString(width / 2, height - 410, context.get("date", ""))
    if context.get("position"):
        c.drawCentredString(width / 2, height - 450, f"Position: {context['position']}")
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, 40, f"Verify at: /verify/{context.get('unique_code', '')}")
    c.save()
    return buf.getvalue()


def _render_pdf_on_template(template_path: Path, placeholders: dict, context: dict[str, str]) -> bytes:
    """Overlay text on a template image using Pillow, then wrap as PDF."""
    from PIL import Image, ImageDraw, ImageFont
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.pdfgen import canvas as rl_canvas

    img = Image.open(template_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    img_w, img_h = img.size

    # Map placeholder keys to context values
    field_map = {
        "name": context.get("name", ""),
        "position": context.get("position", ""),
        "date": context.get("date", ""),
        "event_name": context.get("event_name", ""),
        "club_name": context.get("club_name", ""),
        "unique_code": context.get("unique_code", ""),
    }

    for field, cfg in placeholders.items():
        text = field_map.get(field, "")
        if not text:
            continue
        x = int(cfg.get("x", img_w // 2))
        y = int(cfg.get("y", img_h // 2))
        font_size = int(cfg.get("font_size", 36))
        color = cfg.get("color", "#000000")
        align = cfg.get("align", "center")

        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

        if align == "center":
            bbox = draw.textbbox((0, 0), text, font=font)
            text_w = bbox[2] - bbox[0]
            x = x - text_w // 2
        draw.text((x, y), text, fill=color, font=font)

    # Save image to bytes
    img_buf = BytesIO()
    img.save(img_buf, format="PNG")
    img_buf.seek(0)

    # Embed image into a landscape A4 PDF
    pdf_buf = BytesIO()
    page_w, page_h = landscape(A4)
    c = rl_canvas.Canvas(pdf_buf, pagesize=(page_w, page_h))
    from reportlab.lib.utils import ImageReader
    c.drawImage(
        ImageReader(img_buf), 0, 0, width=page_w, height=page_h, preserveAspectRatio=False
    )
    # Verification footer
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.drawCentredString(page_w / 2, 15, f"Verify at: /verify/{context.get('unique_code', '')}")
    c.save()
    return pdf_buf.getvalue()


def _build_cert_pdf(
    context: dict,
    template: CertificateTemplate | None = None,
) -> tuple[str, bytes]:
    """Generate certificate PDF in memory. Returns (unique_code, pdf_bytes)."""
    unique_code = _generate_unique_code(context.get("event_name", "EVENT"))
    context["unique_code"] = unique_code
    if template and template.template_file_url and template.placeholders:
        rel = template.template_file_url.removeprefix("/media/")
        template_path = Path(settings.LOCAL_STORAGE_PATH) / rel
        if template_path.exists():
            pdf_bytes = _render_pdf_on_template(template_path, template.placeholders, context)
        else:
            pdf_bytes = _render_pdf_plain(context)
    else:
        pdf_bytes = _render_pdf_plain(context)
    return unique_code, pdf_bytes


class CertificateService:
    def __init__(self, repo: CertificateRepository) -> None:
        self.repo = repo

    async def upload_template(
        self, event_id: UUID, cert_type: CertificateType, file_url: str, placeholders: dict | None
    ) -> CertificateTemplate:
        return await self.repo.create_template(
            event_id=event_id,
            certificate_type=cert_type,
            template_file_url=file_url,
            placeholders=placeholders,
        )

    async def bulk_generate(
        self, event_id: UUID, template_id: UUID, recipients: list[dict[str, Any]]
    ) -> list[tuple[Certificate, bytes]]:
        template = await self.repo.get_template(template_id)
        if not template:
            raise NotFoundError("Template", template_id)

        results: list[tuple[Certificate, bytes]] = []
        for r in recipients:
            unique_code, pdf_bytes = _build_cert_pdf(dict(r), template)
            cert = await self.repo.create_certificate(
                template_id=template_id,
                recipient_id=UUID(r["recipient_id"]),
                event_id=event_id,
                certificate_type=template.certificate_type,
                unique_code=unique_code,
                pdf_url=None,
                metadata={k: v for k, v in r.items() if k != "recipient_id"},
            )
            results.append((cert, pdf_bytes))
        return results

    async def generate_participation(
        self, event_id: UUID, event_name: str, club_name: str,
        present_users: list[dict]
    ) -> list[tuple[Certificate, bytes]]:
        if not present_users:
            raise BadRequestError("No attendees marked present for this event")

        date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
        template = await self.repo.get_template_by_event_type(event_id, CertificateType.PARTICIPATION)
        results: list[tuple[Certificate, bytes]] = []

        for u in present_users:
            existing = await self.repo.get_by_event_user_type(
                event_id, UUID(u["user_id"]), CertificateType.PARTICIPATION
            )
            if existing:
                results.append((existing, b""))
                continue

            context = {
                "event_name": event_name,
                "club_name": club_name,
                "name": u["name"],
                "certificate_type": "Participation",
                "date": date_str,
            }
            unique_code, pdf_bytes = _build_cert_pdf(context, template)
            cert = await self.repo.create_certificate(
                template_id=template.id if template else None,
                recipient_id=UUID(u["user_id"]),
                event_id=event_id,
                certificate_type=CertificateType.PARTICIPATION,
                unique_code=unique_code,
                pdf_url=None,
                metadata={"name": u["name"], "event_name": event_name,
                          "certificate_type": "Participation"},
            )
            results.append((cert, pdf_bytes))
        return results

    async def generate_winners(
        self, event_id: UUID, event_name: str, club_name: str,
        winners: list[dict]
    ) -> list[tuple[Certificate, bytes]]:
        date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
        template = await self.repo.get_template_by_event_type(event_id, CertificateType.WINNER)
        results: list[tuple[Certificate, bytes]] = []

        for w in winners:
            position_label = POSITION_LABELS.get(w["position"], w["position"])
            context = {
                "event_name": event_name,
                "club_name": club_name,
                "name": w["name"],
                "certificate_type": "Winner",
                "position": position_label,
                "date": date_str,
            }
            unique_code, pdf_bytes = _build_cert_pdf(context, template)
            meta = {
                "name": w["name"], "event_name": event_name,
                "certificate_type": "Winner", "position": position_label,
            }
            for field in ("prize_amount", "bank_account", "bank_name", "ifsc", "upi"):
                if w.get(field):
                    meta[field] = w[field]
            cert = await self.repo.create_certificate(
                template_id=template.id if template else None,
                recipient_id=UUID(w["user_id"]),
                event_id=event_id,
                certificate_type=CertificateType.WINNER,
                unique_code=unique_code,
                pdf_url=None,
                metadata=meta,
            )
            results.append((cert, pdf_bytes))
        return results

    async def list_by_event(self, event_id: UUID) -> list[Certificate]:
        return await self.repo.list_by_event(event_id)

    async def my_certificates(self, user_id: UUID) -> list[Certificate]:
        return await self.repo.list_by_recipient(user_id)

    async def get_certificate(self, cert_id: UUID) -> Certificate:
        cert = await self.repo.get_certificate(cert_id)
        if not cert:
            raise NotFoundError("Certificate", cert_id)
        return cert

    async def verify_by_code(self, unique_code: str) -> dict:
        cert = await self.repo.get_by_code(unique_code)
        if not cert:
            return {"valid": False}
        meta = cert.metadata_ or {}
        return {
            "valid": True,
            "recipient": meta.get("name", ""),
            "event": meta.get("event_name", ""),
            "certificate_type": cert.certificate_type,
            "issued_at": cert.issued_at.isoformat(),
        }
