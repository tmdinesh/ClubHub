from __future__ import annotations

import base64
import json
import logging
from typing import Any

from app.core.email import send_certificate_email, send_event_update_email, send_new_event_email
from app.core.rabbitmq import Consumer

logger = logging.getLogger(__name__)

# ── Event type constants ───────────────────────────────────────────────────────
REGISTRATION_CONFIRMED = "REGISTRATION_CONFIRMED"
TEAM_INVITATION_SENT = "TEAM_INVITATION_SENT"
ATTENDANCE_MARKED = "ATTENDANCE_MARKED"
RESULTS_PUBLISHED = "RESULTS_PUBLISHED"
CERTIFICATE_GENERATED = "CERTIFICATE_GENERATED"
EVENT_REMINDER = "EVENT_REMINDER"
EVENT_COMPLETED = "EVENT_COMPLETED"


async def _handle_registration_confirmed(payload: dict[str, Any]) -> None:
    logger.info("Sending QR email to user %s for event %s", payload.get("user_id"), payload.get("event_id"))
    # TODO: integrate SMTP / SendGrid

async def _handle_team_invitation(payload: dict[str, Any]) -> None:
    logger.info("Sending team invite to %s", payload.get("email"))


async def _handle_attendance_marked(payload: dict[str, Any]) -> None:
    logger.info("In-app notification: attendance marked for reg %s", payload.get("reg_id"))


async def _handle_certificate_generated(payload: dict[str, Any]) -> None:
    pdf_bytes = base64.b64decode(payload["pdf_b64"]) if payload.get("pdf_b64") else b""
    await send_certificate_email(
        recipient_email=payload["recipient_email"],
        recipient_name=payload["recipient_name"],
        event_name=payload["event_name"],
        club_name=payload["club_name"],
        event_date=payload["event_date"],
        certificate_type=payload["certificate_type"],
        pdf_bytes=pdf_bytes,
        unique_code=payload["unique_code"],
        position=payload.get("position"),
    )


async def _handle_event_reminder(payload: dict[str, Any]) -> None:
    logger.info("Sending event reminder for event %s", payload.get("event_id"))


async def _handle_event_completed(payload: dict[str, Any]) -> None:
    logger.info("Event completed — triggering feedback form for event %s", payload.get("event_id"))


EVENT_UPDATED = "EVENT_UPDATED"
EVENT_CANCELLED = "EVENT_CANCELLED"


async def _handle_event_updated(payload: dict[str, Any]) -> None:
    event_title = payload.get("event_title", "")
    club_name = payload.get("club_name", "ClubHub")
    users = payload.get("users", [])
    logger.info(
        "Event updated — emailing %d registered participants for event %s",
        len(users),
        payload.get("event_id"),
    )
    for user in users:
        await send_event_update_email(
            recipient_email=user["email"],
            recipient_name=user["name"],
            event_title=event_title,
            club_name=club_name,
            message_body=(
                f"Details for <strong>{event_title}</strong> have been updated by the organiser. "
                "Please log in to ClubHub to review the latest information."
            ),
            subject_prefix="Event Updated",
        )


async def _handle_event_cancelled(payload: dict[str, Any]) -> None:
    event_title = payload.get("event_title", "")
    club_name = payload.get("club_name", "ClubHub")
    users = payload.get("users", [])
    logger.info(
        "Event cancelled — emailing %d registered participants for event %s",
        len(users),
        payload.get("event_id"),
    )
    for user in users:
        await send_event_update_email(
            recipient_email=user["email"],
            recipient_name=user["name"],
            event_title=event_title,
            club_name=club_name,
            message_body=(
                f"We regret to inform you that <strong>{event_title}</strong> has been cancelled. "
                "Your registration has been voided. We apologise for any inconvenience."
            ),
            subject_prefix="Event Cancelled",
            cancelled=True,
        )


EVENT_PUBLISHED = "EVENT_PUBLISHED"


async def _handle_event_published(payload: dict[str, Any]) -> None:
    event_title = payload.get("event_title", "")
    club_name = payload.get("club_name", "ClubHub")
    event_url = payload.get("event_url", "")
    start_datetime = payload.get("start_datetime", "")
    venue = payload.get("venue")
    users = payload.get("users", [])
    logger.info(
        "New event published — emailing %d users for event %s",
        len(users),
        payload.get("event_id"),
    )
    for user in users:
        await send_new_event_email(
            recipient_email=user["email"],
            recipient_name=user["name"],
            event_title=event_title,
            club_name=club_name,
            event_url=event_url,
            start_datetime=start_datetime,
            venue=venue,
        )


HANDLERS: dict[str, Any] = {
    REGISTRATION_CONFIRMED: _handle_registration_confirmed,
    TEAM_INVITATION_SENT: _handle_team_invitation,
    ATTENDANCE_MARKED: _handle_attendance_marked,
    CERTIFICATE_GENERATED: _handle_certificate_generated,
    EVENT_REMINDER: _handle_event_reminder,
    EVENT_COMPLETED: _handle_event_completed,
    EVENT_UPDATED: _handle_event_updated,
    EVENT_CANCELLED: _handle_event_cancelled,
    EVENT_PUBLISHED: _handle_event_published,
}


class NotificationConsumer(Consumer):
    QUEUE_NAME = "ccops.notifications"
    ROUTING_KEYS = [
        REGISTRATION_CONFIRMED,
        TEAM_INVITATION_SENT,
        ATTENDANCE_MARKED,
        CERTIFICATE_GENERATED,
        EVENT_REMINDER,
        EVENT_COMPLETED,
        EVENT_UPDATED,
        EVENT_CANCELLED,
        EVENT_PUBLISHED,
    ]

    async def handle(self, payload: dict[str, Any]) -> None:
        event_type = payload.get("type", "")
        handler = HANDLERS.get(event_type)
        if handler:
            await handler(payload)
        else:
            logger.warning("No handler for notification type: %s", event_type)
