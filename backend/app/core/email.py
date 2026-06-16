from __future__ import annotations

import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_html(
    recipient_name: str,
    event_name: str,
    club_name: str,
    event_date: str,
    certificate_type: str,
    position: str | None = None,
    verify_url: str | None = None,
) -> str:
    cert_label = "Winner Certificate" if certificate_type == "Winner" else "Certificate of Participation"
    position_row = ""
    if position:
        position_row = f"""
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:14px;">Position</td>
          <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">{position}</td>
        </tr>"""

    verify_section = ""
    if verify_url:
        verify_section = f"""
      <div style="margin-top:32px;padding:18px 24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
        <p style="margin:0 0 8px;font-size:13px;color:#15803d;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">
          Verify Authenticity
        </p>
        <a href="{verify_url}" style="font-size:13px;color:#16a34a;word-break:break-all;">{verify_url}</a>
      </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>{cert_label}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Institutional header -->
          <tr>
            <td style="background:#ffffff;padding:20px 32px 16px;border-bottom:1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:48px;">
                    <img src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png"
                         alt="PSG Tech" width="40" height="40"
                         style="display:block;width:40px;height:auto;" />
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <p style="margin:0;font-size:15px;font-weight:700;color:#111827;line-height:1.2;">
                      PSG College of Technology
                    </p>
                    <p style="margin:3px 0 0;font-size:11px;color:#6b7280;">
                      Peelamedu, Coimbatore – 641 004
                    </p>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:11px;color:#9ca3af;font-style:italic;">via ClubHub</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Certificate type header bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4f46e5 100%);padding:28px 32px 22px;">
              <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
                {club_name}
              </p>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;">
                {cert_label}
              </h1>
              <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_name} &nbsp;·&nbsp; {event_date}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">

              <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
                Dear <strong style="color:#111827;">{recipient_name}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
                Congratulations! On behalf of <strong>{club_name}</strong>, we are pleased to
                present your <strong>{cert_label}</strong> for your participation in
                <strong>{event_name}</strong>. Your certificate is attached to this email as a PDF.
              </p>

              <!-- Details table -->
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 22px;margin-bottom:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%;">Event</td>
                    <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">{event_name}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:13px;">Organised by</td>
                    <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">{club_name}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:13px;">Date</td>
                    <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">{event_date}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-size:13px;">Certificate</td>
                    <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">{cert_label}</td>
                  </tr>{position_row}
                </table>
              </div>

              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6;">
                Please find your certificate attached. You may download, print, or share it as needed.
              </p>

              {verify_section}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;line-height:1.6;">
                      This is an automated message sent via <strong style="color:#6b7280;">ClubHub</strong> on behalf of {club_name}.
                      Please do not reply to this email.
                      If you encounter any issues with your certificate, please contact your Club Admin.
                    </p>
                    <p style="margin:0;font-size:10px;color:#d1d5db;">
                      © All rights reserved · PSG Tech Students' Union &nbsp;·&nbsp; Developed by Dinesh T M (23Z320)
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>"""


async def send_certificate_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_name: str,
    club_name: str,
    event_date: str,
    certificate_type: str,
    pdf_bytes: bytes,
    unique_code: str,
    position: str | None = None,
) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured — skipping certificate email to %s", recipient_email)
        return

    verify_url = f"{settings.FRONTEND_URL}/verify/{unique_code}"
    cert_label = "Winner Certificate" if certificate_type == "Winner" else "Certificate of Participation"
    subject = f"{club_name} · {event_name} — Your {cert_label}"

    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = recipient_email

    html_body = _build_html(
        recipient_name=recipient_name,
        event_name=event_name,
        club_name=club_name,
        event_date=event_date,
        certificate_type=certificate_type,
        position=position,
        verify_url=verify_url,
    )
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if pdf_bytes:
        attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
        attachment.add_header(
            "Content-Disposition",
            "attachment",
            filename=f"{unique_code}.pdf",
        )
        msg.attach(attachment)

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("Certificate email sent to %s for %s", recipient_email, event_name)
    except Exception:
        logger.exception("Failed to send certificate email to %s", recipient_email)
