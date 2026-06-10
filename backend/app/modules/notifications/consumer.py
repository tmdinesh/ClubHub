from __future__ import annotations

import json
import logging
from typing import Any

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
    logger.info("Sending certificate email for cert at %s", payload.get("pdf_url"))


async def _handle_event_reminder(payload: dict[str, Any]) -> None:
    logger.info("Sending event reminder for event %s", payload.get("event_id"))


async def _handle_event_completed(payload: dict[str, Any]) -> None:
    logger.info("Event completed — triggering feedback form for event %s", payload.get("event_id"))


EVENT_UPDATED = "EVENT_UPDATED"
EVENT_CANCELLED = "EVENT_CANCELLED"


async def _handle_event_updated(payload: dict[str, Any]) -> None:
    logger.info(
        "Event updated — notifying %d registered participants for event %s",
        len(payload.get("users", [])),
        payload.get("event_id"),
    )
    for user in payload.get("users", []):
        logger.info(
            "  → Notify %s (%s): event '%s' has been updated",
            user.get("name"), user.get("email"), payload.get("event_title"),
        )


async def _handle_event_cancelled(payload: dict[str, Any]) -> None:
    logger.info(
        "Event cancelled — notifying %d registered participants for event %s",
        len(payload.get("users", [])),
        payload.get("event_id"),
    )
    for user in payload.get("users", []):
        logger.info(
            "  → Notify %s (%s): event '%s' has been cancelled",
            user.get("name"), user.get("email"), payload.get("event_title"),
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
    ]

    async def handle(self, payload: dict[str, Any]) -> None:
        event_type = payload.get("type", "")
        handler = HANDLERS.get(event_type)
        if handler:
            await handler(payload)
        else:
            logger.warning("No handler for notification type: %s", event_type)
