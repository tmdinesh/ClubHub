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
    """Default branded certificate — landscape A4, styled to match ClubHub email templates."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas
    import urllib.request

    buf = BytesIO()
    W, H = landscape(A4)  # 841.9 x 595.3 pt
    c = canvas.Canvas(buf, pagesize=(W, H))

    is_winner = context.get("certificate_type", "").lower() == "winner"

    # ── Background: white ─────────────────────────────────────────────────────
    c.setFillColorRGB(1, 1, 1)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # ── Header band (fixed 88 pt, compact like email header) ──────────────────
    band_h = 88
    steps = 60
    if is_winner:
        r0, g0, b0 = 0.471, 0.208, 0.055   # #78350f
        r1, g1, b1 = 0.855, 0.467, 0.024   # #d97706
    else:
        r0, g0, b0 = 0.118, 0.106, 0.294   # #1e1b4b
        r1, g1, b1 = 0.310, 0.275, 0.898   # #4f46e5
    for i in range(steps):
        t = i / steps
        r, g, b = r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t
        y = H - band_h + (band_h / steps) * i
        c.setFillColorRGB(r, g, b)
        c.rect(0, y, W, band_h / steps + 1, fill=1, stroke=0)

    # Thin top edge stripe
    c.setFillColorRGB(*(0.855, 0.467, 0.024) if is_winner else (0.310, 0.275, 0.898))
    c.rect(0, H - 4, W, 4, fill=1, stroke=0)

    # ── PSG Tech logo ─────────────────────────────────────────────────────────
    logo_size = 38
    logo_x = 32
    logo_y = H - band_h + (band_h - logo_size) / 2
    try:
        logo_url = (
            "https://upload.wikimedia.org/wikipedia/en/e/eb/"
            "PSG_College_of_Technology_logo.png"
        )
        req = urllib.request.Request(logo_url, headers={"User-Agent": "ClubHub/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:  # noqa: S310
            logo_reader = ImageReader(BytesIO(resp.read()))
        c.drawImage(logo_reader, logo_x, logo_y, width=logo_size, height=logo_size,
                    preserveAspectRatio=True, mask="auto")
    except Exception:
        pass

    # Institution name
    text_x = logo_x + logo_size + 10
    text_mid = logo_y + logo_size / 2
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(text_x, text_mid + 5, "PSG College of Technology")
    sub_color = (0.98, 0.88, 0.70) if is_winner else (0.78, 0.80, 0.95)
    c.setFillColorRGB(*sub_color)
    c.setFont("Helvetica", 8.5)
    c.drawString(text_x, text_mid - 7, "Peelamedu, Coimbatore – 641 004")

    # "via ClubHub" right side
    c.setFillColorRGB(*sub_color)
    c.setFont("Helvetica-Oblique", 8.5)
    c.drawRightString(W - 32, text_mid - 1, "via ClubHub")

    # Separator below header
    c.setStrokeColorRGB(0.898, 0.906, 0.918)
    c.setLineWidth(0.5)
    c.line(0, H - band_h, W, H - band_h)

    # ── Left accent bar ────────────────────────────────────────────────────────
    bar_color = (0.855, 0.467, 0.024) if is_winner else (0.310, 0.275, 0.898)
    c.setFillColorRGB(*bar_color)
    c.rect(0, 0, 6, H - band_h, fill=1, stroke=0)

    # ── Body — vertically centred in the white area ───────────────────────────
    pad_l = 36
    pad_r = 44
    body_area_top = H - band_h      # top of white area  (~507 pt)
    body_area_bot = 38              # above footer text
    body_h = body_area_top - body_area_bot  # ~469 pt

    club_name = context.get("club_name", "")
    cert_label = "Winner Certificate" if is_winner else "Certificate of Participation"
    recipient = context.get("name", "Recipient")
    has_position = bool(context.get("position"))
    unique_code = context.get("unique_code", "")

    # Measure total content height (top baseline to bottom of last element)
    #   club label line:    8 pt cap-height
    #   gap:               10
    #   cert heading:      20 pt cap-height
    #   gap:               12
    #   name extra offset: 20 pt (pushed down for visual breathing room)
    #   name:              36 pt cap-height
    #   gap below name:     6
    #   rule:               1
    #   gap:               16
    #   table rows (each 20 pt, baseline to baseline):
    n_rows = 4 if has_position else 3
    #   verify box:  14 gap + 52 box  (if code present)
    verify_h = (14 + 52) if unique_code else 0
    content_h = (8 + 10 + 20 + 12 + 20 + 36 + 6 + 1 + 16
                 + n_rows * 20
                 + verify_h)

    # Top of content block — centred in body area
    # body_area_bot + offset_from_bottom + content_h = top baseline
    top = body_area_bot + (body_h - content_h) / 2 + content_h

    # Draw from top downward, tracking current Y baseline
    y = top

    # Club label
    c.setFont("Helvetica-Bold", 8)
    c.setFillColorRGB(0.42, 0.45, 0.50)
    c.drawString(pad_l, y, club_name.upper())
    y -= (8 + 10)   # cap-height + gap

    # Certificate heading
    c.setFont("Helvetica-Bold", 20)
    c.setFillColorRGB(0.067, 0.094, 0.153)
    c.drawString(pad_l, y, cert_label)
    y -= (20 + 12 + 20)  # cap-height + gap + extra 20 pt push for name

    # Recipient name
    c.setFont("Helvetica-Bold", 36)
    name_color = (0.471, 0.208, 0.055) if is_winner else (0.310, 0.275, 0.898)
    c.setFillColorRGB(*name_color)
    c.drawString(pad_l, y, recipient)
    y -= (36 + 6)   # cap-height + gap

    # Rule
    c.setStrokeColorRGB(0.878, 0.882, 0.894)
    c.setLineWidth(0.75)
    c.line(pad_l, y, W - pad_r, y)
    y -= (1 + 16)   # rule + gap

    # Details table
    col1_x = pad_l
    col2_x = pad_l + 108
    rows = [
        ("Event",        context.get("event_name", "")),
        ("Organised by", club_name),
        ("Date",         context.get("date", "")),
    ]
    if has_position:
        rows.append(("Position", context["position"]))

    for label, value in rows:
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.42, 0.45, 0.50)
        c.drawString(col1_x, y, label)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColorRGB(0.067, 0.094, 0.153)
        c.drawString(col2_x, y, value)
        y -= 20

    # Verify block
    if unique_code:
        y -= 14     # gap above box
        vbox_h = 52
        vbox_w = min(W * 0.62, W - pad_l - pad_r)

        c.setFillColorRGB(0.941, 0.992, 0.961)
        c.setStrokeColorRGB(0.733, 0.969, 0.816)
        c.setLineWidth(0.75)
        c.roundRect(col1_x, y - vbox_h, vbox_w, vbox_h, 6, fill=1, stroke=1)

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColorRGB(0.086, 0.502, 0.239)
        c.drawString(col1_x + 12, y - 14, "VERIFY AUTHENTICITY")

        verify_url = f"{settings.FRONTEND_URL}/verify/{unique_code}"
        c.setFont("Helvetica", 8.5)
        c.setFillColorRGB(0.086, 0.639, 0.298)
        c.drawString(col1_x + 12, y - 28, verify_url)

        c.setFont("Helvetica", 7.5)
        c.setFillColorRGB(0.42, 0.45, 0.50)
        c.drawString(col1_x + 12, y - 40, f"Code: {unique_code}")

    # ── Footer ────────────────────────────────────────────────────────────────
    c.setFont("Helvetica", 7.5)
    c.setFillColorRGB(0.62, 0.64, 0.67)
    c.drawCentredString(
        W / 2, 22,
        "This certificate was issued via ClubHub on behalf of the club. "
        "© All rights reserved · PSG Tech Students’ Union",
    )

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
            existing = await self.repo.get_by_event_user_type(
                event_id, UUID(w["user_id"]), CertificateType.WINNER
            )
            if existing:
                # Update metadata with any bank details provided in this run
                meta = dict(existing.metadata_ or {})
                for field in ("prize_amount", "bank_account", "bank_name", "ifsc", "upi"):
                    val = w.get(field)
                    if val is not None and val != "":
                        meta[field] = val
                from sqlalchemy.orm.attributes import flag_modified
                existing.metadata_ = meta
                flag_modified(existing, "metadata_")
                await self.repo.db.flush()
                results.append((existing, b""))
                continue

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
