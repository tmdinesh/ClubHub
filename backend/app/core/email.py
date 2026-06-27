from __future__ import annotations

import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


def _email_header_html(club_name: str) -> str:
    return f"""
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
      </table>"""


def _email_footer_html(club_name: str) -> str:
    return f"""
      <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;line-height:1.6;">
        This is an automated message sent via <strong style="color:#6b7280;">ClubHub</strong> on behalf of {club_name}.
        Please do not reply to this email.
      </p>
      <p style="margin:0;font-size:10px;color:#d1d5db;">
        © All rights reserved · PSG Tech Students' Union &nbsp;·&nbsp; Developed by Dinesh T M (23Z320)
      </p>"""


def _wrap_email(header: str, accent_block: str, body_html: str, footer: str, *, cancelled: bool = False) -> str:
    gradient = (
        "linear-gradient(135deg,#4a0000 0%,#7f1d1d 60%,#dc2626 100%)"
        if cancelled else
        "linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4f46e5 100%)"
    )
    accent_label_color = "#fca5a5" if cancelled else "#a5b4fc"
    accent_sub_color = "#fecaca" if cancelled else "#c7d2fe"
    # Replace the accent block's hardcoded colours with the right palette
    accent_block = accent_block.replace("#a5b4fc", accent_label_color).replace("#c7d2fe", accent_sub_color)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
          <tr>
            <td style="background:#ffffff;padding:20px 32px 16px;border-bottom:1px solid #e5e7eb;">
              {header}
            </td>
          </tr>
          <tr>
            <td style="background:{gradient};padding:28px 32px 22px;">
              {accent_block}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              {body_html}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;">
              {footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def _send(*, to: str, subject: str, html: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured — skipping email to %s", to)
        return
    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("Email sent to %s — %s", to, subject)
    except Exception:
        logger.exception("Failed to send email to %s", to)


async def send_event_update_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_title: str,
    club_name: str,
    message_body: str,
    subject_prefix: str,
    cancelled: bool = False,
) -> None:
    header = _email_header_html(club_name)
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        {club_name}
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        {subject_prefix}
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_title}</p>"""
    body = f"""
      <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
        {message_body}
      </p>"""
    footer = _email_footer_html(club_name)
    html = _wrap_email(header, accent, body, footer, cancelled=cancelled)
    await _send(
        to=recipient_email,
        subject=f"{club_name} · {event_title} — {subject_prefix}",
        html=html,
    )


async def send_new_event_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_title: str,
    club_name: str,
    event_url: str,
    start_datetime: str,
    venue: str | None,
) -> None:
    header = _email_header_html(club_name)
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        {club_name}
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        New Event Added
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_title}</p>"""
    venue_line = f"<p style='margin:0 0 6px;font-size:14px;color:#4b5563;'><strong>Venue:</strong> {venue}</p>" if venue else ""
    body = f"""
      <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.7;">
        <strong>{club_name}</strong> has published a new event. Don't miss out!
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#111827;">{event_title}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#4b5563;"><strong>Date:</strong> {start_datetime}</p>
        {venue_line}
      </div>
      <a href="{event_url}"
         style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;
                font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
        View Event
      </a>"""
    footer = _email_footer_html(club_name)
    html = _wrap_email(header, accent, body, footer)
    await _send(
        to=recipient_email,
        subject=f"{club_name} · New Event: {event_title}",
        html=html,
    )


async def send_event_reminder_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_title: str,
    club_name: str,
    event_url: str,
    start_datetime: str,
    venue: str | None,
) -> None:
    header = _email_header_html(club_name)
    venue_line = f"<p style='margin:0 0 6px;font-size:14px;color:#4b5563;'><strong>Venue:</strong> {venue}</p>" if venue else ""
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        {club_name}
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        Event Reminder — Tomorrow!
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_title}</p>"""
    body = f"""
      <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.7;">
        This is a reminder that <strong>{event_title}</strong> is happening <strong>tomorrow</strong>.
        We look forward to seeing you there!
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#111827;">{event_title}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#4b5563;"><strong>Date:</strong> {start_datetime}</p>
        {venue_line}
      </div>
      <a href="{event_url}"
         style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;
                font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
        View Event
      </a>"""
    footer = _email_footer_html(club_name)
    html = _wrap_email(header, accent, body, footer)
    await _send(
        to=recipient_email,
        subject=f"Reminder: {event_title} is tomorrow!",
        html=html,
    )


async def send_feedback_request_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_title: str,
    club_name: str,
    feedback_url: str,
) -> None:
    header = _email_header_html(club_name)
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        {club_name}
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        Share Your Feedback
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_title}</p>"""
    body = f"""
      <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
        Thank you for attending <strong>{event_title}</strong>!
        We'd love to hear your thoughts — it only takes a minute and helps us make future events even better.
      </p>
      <a href="{feedback_url}"
         style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;
                font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
        Submit Feedback
      </a>"""
    footer = _email_footer_html(club_name)
    html = _wrap_email(header, accent, body, footer)
    await _send(
        to=recipient_email,
        subject=f"{club_name} · {event_title} — Share Your Feedback",
        html=html,
    )


async def send_event_completion_reminder_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_title: str,
    club_name: str,
    days_since_end: int,
    days_remaining: int,
    manage_url: str,
) -> None:
    """Reminder to club admin to mark event complete after it has ended."""
    header = _email_header_html(club_name)
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        Action Required
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        Close Your Event
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_title}</p>"""
    body = f"""
      <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.7;">
        Your event <strong>{event_title}</strong> ended {days_since_end} day{"s" if days_since_end != 1 else ""} ago
        and has not yet been marked as complete.
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
        Please complete the following before closing the event:
      </p>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#4b5563;line-height:2;">
        <li>Confirm all attendance has been marked</li>
        <li>Record event expenditure in the Finance tab</li>
        <li>Issue participation and winner certificates</li>
      </ul>
      <p style="margin:0 0 24px;font-size:14px;color:#ef4444;font-weight:600;">
        ⚠ The event will be automatically closed in {days_remaining} day{"s" if days_remaining != 1 else ""} if no action is taken.
      </p>
      <a href="{manage_url}"
         style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;
                font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
        Go to Event Dashboard
      </a>"""
    footer = _email_footer_html(club_name)
    html = _wrap_email(header, accent, body, footer)
    await _send(
        to=recipient_email,
        subject=f"[Action Required] Close event within {days_remaining} day{'s' if days_remaining != 1 else ''}: {event_title}",
        html=html,
    )


async def send_faculty_close_warning_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_title: str,
    club_name: str,
    manage_url: str,
) -> None:
    """Notice to faculty advisor: 1 day left before auto-completion."""
    header = _email_header_html(club_name)
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#fca5a5;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        Faculty Advisor Notice
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        1 Day Left to Close Event
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#fecaca;">{event_title}</p>"""
    body = f"""
      <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.7;">
        The event <strong>{event_title}</strong> organised by <strong>{club_name}</strong> ended 6 days ago
        and has still not been marked as complete.
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
        <strong style="color:#dc2626;">Only 1 day remains</strong> before the event is automatically closed by the system.
        Please ensure the club admin updates the finance records, issues certificates, and closes the event before the deadline.
      </p>
      <a href="{manage_url}"
         style="display:inline-block;padding:12px 28px;background:#dc2626;color:#ffffff;
                font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
        View Event Dashboard
      </a>"""
    footer = _email_footer_html(club_name)
    html = _wrap_email(header, accent, body, footer, cancelled=True)
    await _send(
        to=recipient_email,
        subject=f"[URGENT] 1 day left to close: {event_title}",
        html=html,
    )



async def send_team_notification_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_title: str,
    club_name: str,
    team_name: str,
    action: str,        # "joined" | "removed" | "member_joined"
    new_member_name: str | None = None,
) -> None:
    header = _email_header_html(club_name)
    if action == "joined":
        headline = "You've Joined a Team"
        body_text = (
            f"You have joined team <strong>{team_name}</strong> "
            f"for the event <strong>{event_title}</strong>."
        )
    elif action == "member_joined":
        headline = "A New Member Joined Your Team"
        body_text = (
            f"<strong>{new_member_name}</strong> has joined your team "
            f"<strong>{team_name}</strong> for <strong>{event_title}</strong>."
        )
    else:
        headline = "You've Been Removed from a Team"
        body_text = (
            f"You have been removed from team <strong>{team_name}</strong> "
            f"for the event <strong>{event_title}</strong>."
        )
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        {club_name}
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        {headline}
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_title}</p>"""
    body = f"""
      <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
        {body_text}
      </p>"""
    footer = _email_footer_html(club_name)
    html = _wrap_email(header, accent, body, footer)
    await _send(
        to=recipient_email,
        subject=f"{club_name} · Team Update: {team_name}",
        html=html,
    )


async def send_team_submit_reminder_email(
    *,
    recipient_email: str,
    recipient_name: str,
    event_title: str,
    club_name: str,
    team_name: str,
    min_size: int,
) -> None:
    header = _email_header_html(club_name)
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        {club_name}
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        Your Team Is Ready to Submit!
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_title}</p>"""
    body = f"""
      <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
        Team <strong>{team_name}</strong> now has at least <strong>{min_size} members</strong> —
        the minimum required for <strong>{event_title}</strong>.
        The team lead can now submit the team from the Teams page.
      </p>"""
    footer = _email_footer_html(club_name)
    html = _wrap_email(header, accent, body, footer)
    await _send(
        to=recipient_email,
        subject=f"{club_name} · Submit Your Team: {team_name}",
        html=html,
    )


def _build_certificate_email_html(
    *,
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
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">Position</td>
          <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">{position}</td>
        </tr>"""

    verify_section = ""
    if verify_url:
        verify_section = f"""
      <div style="margin-top:24px;padding:18px 24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
        <p style="margin:0 0 8px;font-size:13px;color:#15803d;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">
          Verify Authenticity
        </p>
        <a href="{verify_url}" style="font-size:13px;color:#16a34a;word-break:break-all;">{verify_url}</a>
      </div>"""

    header = _email_header_html(club_name)
    accent = f"""
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">
        {club_name}
      </p>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;">
        {cert_label}
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;">{event_name} &nbsp;·&nbsp; {event_date}</p>"""
    body = f"""
      <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
        Dear <strong style="color:#111827;">{recipient_name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
        Congratulations! On behalf of <strong>{club_name}</strong>, we are pleased to
        present your <strong>{cert_label}</strong> for your participation in
        <strong>{event_name}</strong>. Your certificate is attached to this email as a PDF.
      </p>
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
      {verify_section}"""
    footer = f"""
      <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;line-height:1.6;">
        This is an automated message sent via <strong style="color:#6b7280;">ClubHub</strong> on behalf of {club_name}.
        Please do not reply to this email.
        If you encounter any issues with your certificate, please contact your Club Admin.
      </p>
      <p style="margin:0;font-size:10px;color:#d1d5db;">
        © All rights reserved · PSG Tech Students' Union &nbsp;·&nbsp; Developed by Dinesh T M (23Z320)
      </p>"""
    return _wrap_email(header, accent, body, footer)


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

    html_body = _build_certificate_email_html(
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
