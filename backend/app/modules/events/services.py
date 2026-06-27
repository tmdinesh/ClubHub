from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from uuid import UUID

from app.modules.auth.models import User
from app.modules.events.events import EventCompleted, EventCreated, EventStatusChanged
from app.modules.events.models import Event, EventOrganizer
from app.modules.events.repos import EventRepository
from app.shared.enums import ApprovalStatus, EventStatus, UserRole
from app.shared.exceptions import BadRequestError, ForbiddenError, NotFoundError

# Valid forward transitions in the state machine
_TRANSITIONS: dict[EventStatus, set[EventStatus]] = {
    EventStatus.DRAFT: {EventStatus.PENDING_APPROVAL},
    EventStatus.PENDING_APPROVAL: {EventStatus.PUBLISHED, EventStatus.DRAFT},
    EventStatus.PUBLISHED: {EventStatus.COMPLETED},
    EventStatus.COMPLETED: {EventStatus.ARCHIVED},
    EventStatus.ARCHIVED: set(),
}


def _generate_slug(title: str, suffix: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"{base}-{suffix}"


class EventService:
    def __init__(self, repo: EventRepository) -> None:
        self.repo = repo

    def _assert_transition(self, current: EventStatus, target: EventStatus) -> None:
        if target not in _TRANSITIONS.get(current, set()):
            raise BadRequestError(
                f"Cannot transition from {current} to {target}. "
                f"Allowed: {[s.value for s in _TRANSITIONS.get(current, set())]}"
            )

    async def create_event(self, data: dict, actor: User) -> Event:
        if actor.role not in (UserRole.SUPER_ADMIN, UserRole.CLUB_ADMIN):
            raise ForbiddenError("Only Club Admins can create events")

        if actor.role == UserRole.CLUB_ADMIN:
            if not actor.club_id:
                raise ForbiddenError("Your account is not mapped to a club. Ask a Super Admin to assign you.")
            data["organizer_club_id"] = actor.club_id
            if not data.get("faculty_advisor_id"):
                club = await self.repo.get_club(actor.club_id)
                if club and club.faculty_advisor_id:
                    data["faculty_advisor_id"] = club.faculty_advisor_id

        if not data.get("organizer_club_id"):
            raise BadRequestError("organizer_club_id is required")

        slug_suffix = uuid.uuid4().hex[:6]
        slug = _generate_slug(data["title"], slug_suffix)
        while await self.repo.slug_exists(slug):
            slug = _generate_slug(data["title"], uuid.uuid4().hex[:6])
        return await self.repo.create(slug=slug, **data)

    async def get_event(self, event_id: UUID) -> Event:
        event = await self.repo.get_event(event_id)
        if not event:
            raise NotFoundError("Event", event_id)
        return event

    async def get_event_by_slug(self, slug: str) -> Event:
        event = await self.repo.get_by_slug(slug)
        if not event:
            raise NotFoundError("Event", slug)
        return event

    async def list_events(self, **filters) -> list[Event]:
        return await self.repo.list_events(**filters)

    async def update_event(self, event_id: UUID, data: dict, actor: User,
                           reg_repo=None, notif_repo=None) -> Event:
        event = await self.get_event(event_id)
        if event.status not in (EventStatus.DRAFT, EventStatus.PUBLISHED):
            raise BadRequestError("Events can only be edited in DRAFT or PUBLISHED status")
        allowed_roles = {UserRole.SUPER_ADMIN, UserRole.CLUB_ADMIN, UserRole.EVENT_HEAD}
        if actor.role not in allowed_roles:
            raise ForbiddenError("Insufficient role to update event")
        updated = await self.repo.update(event, **data)

        # Notify confirmed participants when a published event is updated
        if event.status == EventStatus.PUBLISHED and reg_repo and notif_repo:
            users = await reg_repo.list_confirmed_with_users(event_id)
            club_name = event.organizer_club.name if event.organizer_club else "ClubHub"
            for u in users:
                await notif_repo.create(
                    user_id=u["user_id"],
                    type="EVENT_UPDATE",
                    title=f"Event updated: {updated.title}",
                    body="Details for this event have been updated. Please review the latest information.",
                    metadata_={"event_id": str(event_id)},
                )
            from app.modules.notifications.consumer import _handle_event_updated, EVENT_UPDATED
            await _handle_event_updated({
                "type": EVENT_UPDATED,
                "event_id": str(event_id),
                "event_title": updated.title,
                "club_name": club_name,
                "users": users,
            })

        return updated

    async def cancel_event(self, event_id: UUID, actor: User,
                           reg_repo=None, notif_repo=None) -> Event:
        """Cancel a PUBLISHED event: soft-delete it and notify all confirmed registrants."""
        if actor.role not in (UserRole.SUPER_ADMIN, UserRole.CLUB_ADMIN):
            raise ForbiddenError("Only Club Admins can cancel events")
        event = await self.get_event(event_id)
        if event.status not in (EventStatus.PUBLISHED, EventStatus.DRAFT,
                                 EventStatus.PENDING_APPROVAL):
            raise BadRequestError("Only DRAFT, PENDING_APPROVAL, or PUBLISHED events can be cancelled")

        # Notify registered participants before soft-delete
        if reg_repo and notif_repo:
            users = await reg_repo.list_confirmed_with_users(event_id)
            club_name = event.organizer_club.name if event.organizer_club else "ClubHub"
            for u in users:
                await notif_repo.create(
                    user_id=u["user_id"],
                    type="EVENT_UPDATE",
                    title=f"Event cancelled: {event.title}",
                    body="We're sorry, this event has been cancelled. Your registration has been voided.",
                    metadata_={"event_id": str(event_id)},
                )
            from app.modules.notifications.consumer import _handle_event_cancelled, EVENT_CANCELLED
            await _handle_event_cancelled({
                "type": EVENT_CANCELLED,
                "event_id": str(event_id),
                "event_title": event.title,
                "club_name": club_name,
                "users": users,
            })

        await self.repo.soft_delete(event)
        return event

    async def submit_for_review(self, event_id: UUID, actor: User) -> Event:
        event = await self.get_event(event_id)
        self._assert_transition(event.status, EventStatus.PENDING_APPROVAL)

        # If the event has no advisor set, try to pull it from the club
        if not event.faculty_advisor_id:
            club = await self.repo.get_club(event.organizer_club_id)
            if club and club.faculty_advisor_id:
                event = await self.repo.update(event, faculty_advisor_id=club.faculty_advisor_id)

        if not event.faculty_advisor_id:
            raise BadRequestError(
                "No faculty advisor is assigned to this club. "
                "Ask a Super Admin to assign one before submitting for review."
            )
        await self.repo.create_approval(event_id, event.faculty_advisor_id)
        return await self.repo.update(event, status=EventStatus.PENDING_APPROVAL)

    async def approve_event(self, event_id: UUID, actor: User, user_repo=None) -> Event:
        if actor.role not in (UserRole.SUPER_ADMIN, UserRole.FACULTY_ADVISOR):
            raise ForbiddenError("Only Faculty Advisors can approve events")
        event = await self.get_event(event_id)
        self._assert_transition(event.status, EventStatus.PUBLISHED)
        approval = await self.repo.get_pending_approval(event_id)
        if approval:
            approval.status = ApprovalStatus.APPROVED
            approval.reviewed_at = datetime.now(timezone.utc)
        updated = await self.repo.update(event, status=EventStatus.PUBLISHED)

        # Broadcast new event notification to all users
        if user_repo:
            all_users = await user_repo.list_all()
            club_name = event.organizer_club.name if event.organizer_club else "ClubHub"
            event_slug = updated.slug
            start_dt = (
                updated.start_datetime.strftime("%d %b %Y, %I:%M %p IST")
                if updated.start_datetime else "TBD"
            )
            event_url = f"{__import__('app').core.config.settings.FRONTEND_URL}/events/{event_slug}"
            from app.modules.notifications.consumer import _handle_event_published, EVENT_PUBLISHED
            await _handle_event_published({
                "type": EVENT_PUBLISHED,
                "event_id": str(event_id),
                "event_title": updated.title,
                "club_name": club_name,
                "event_url": event_url,
                "start_datetime": start_dt,
                "venue": updated.venue,
                "users": [{"user_id": str(u.id), "name": u.name, "email": u.email} for u in all_users],
            })

        return updated

    async def reject_event(self, event_id: UUID, comment: str, actor: User) -> Event:
        if actor.role not in (UserRole.SUPER_ADMIN, UserRole.FACULTY_ADVISOR):
            raise ForbiddenError("Only Faculty Advisors can reject events")
        if not comment:
            raise BadRequestError("Rejection comment is required")
        event = await self.get_event(event_id)
        self._assert_transition(event.status, EventStatus.DRAFT)
        approval = await self.repo.get_pending_approval(event_id)
        if approval:
            approval.status = ApprovalStatus.REJECTED
            approval.comment = comment
            approval.reviewed_at = datetime.now(timezone.utc)
        return await self.repo.update(event, status=EventStatus.DRAFT)

    async def complete_event(
        self, event_id: UUID, actor: User,
        reg_repo=None, notif_repo=None, feedback_svc=None,
    ) -> Event:
        if actor.role not in (UserRole.SUPER_ADMIN, UserRole.CLUB_ADMIN):
            raise ForbiddenError("Only Club Admins can mark events as complete")
        event = await self.get_event(event_id)
        self._assert_transition(event.status, EventStatus.COMPLETED)
        if event.end_datetime:
            from datetime import datetime, timezone
            if datetime.now(timezone.utc) < event.end_datetime:
                raise BadRequestError("Event cannot be marked complete before it has ended")
        updated = await self.repo.update(event, status=EventStatus.COMPLETED)

        # Auto-create fixed feedback form
        if feedback_svc:
            await feedback_svc.setup_for_event(event_id)

        # Notify confirmed participants to fill feedback
        if reg_repo and notif_repo:
            users = await reg_repo.list_confirmed_with_users(event_id)
            club_name = event.organizer_club.name if event.organizer_club else "ClubHub"
            feedback_url = f"{__import__('app').core.config.settings.FRONTEND_URL}/dashboard/feedback/{event_id}"
            for u in users:
                await notif_repo.create(
                    user_id=u["user_id"],
                    type="EVENT_UPDATE",
                    title=f"Share your feedback: {updated.title}",
                    body="The event has concluded. We'd love to hear your thoughts — please take a moment to fill in the feedback form.",
                    metadata_={"event_id": str(event_id), "feedback_url": feedback_url},
                )
            from app.core.email import send_feedback_request_email
            for u in users:
                await send_feedback_request_email(
                    recipient_email=u["email"],
                    recipient_name=u["name"],
                    event_title=updated.title,
                    club_name=club_name,
                    feedback_url=feedback_url,
                )

        return updated
        if actor.role != UserRole.SUPER_ADMIN:
            raise ForbiddenError("Only Super Admins can delete events")
        event = await self.get_event(event_id)
        await self.repo.soft_delete(event)

    async def assign_organizer(
        self, event_id: UUID, user_id: UUID, role: str, permissions: dict | None, actor: User
    ) -> EventOrganizer:
        if actor.role not in (UserRole.SUPER_ADMIN, UserRole.CLUB_ADMIN):
            raise ForbiddenError("Only Club Admins can assign organizers")
        return await self.repo.add_organizer(event_id, user_id, role, permissions)
