"""Unit tests for events module."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.modules.auth.models import User
from app.modules.events.models import Event
from app.modules.events.repos import EventRepository
from app.modules.events.services import EventService
from app.shared.enums import EventStatus, UserRole
from app.shared.exceptions import BadRequestError, ForbiddenError


def _make_user(role: UserRole = UserRole.CLUB_ADMIN) -> User:
    u = User()
    u.id = uuid4()
    u.role = role
    u.email = "admin@college.edu"
    u.name = "Admin"
    u.is_active = True
    return u


def _make_event(status: EventStatus = EventStatus.DRAFT) -> Event:
    e = Event()
    e.id = uuid4()
    e.title = "Test Event"
    e.slug = "test-event-abc123"
    e.status = status
    e.is_deleted = False
    e.faculty_advisor_id = uuid4()
    e.organizer_club_id = uuid4()
    return e


class TestStatusTransitions:
    @pytest.mark.asyncio
    async def test_draft_to_pending_approval(self):
        repo = AsyncMock(spec=EventRepository)
        event = _make_event(EventStatus.DRAFT)
        repo.get_event = AsyncMock(return_value=event)
        repo.update = AsyncMock(return_value=event)
        repo.create_approval = AsyncMock(return_value=MagicMock())
        repo.get_pending_approval = AsyncMock(return_value=None)

        svc = EventService(repo)
        actor = _make_user(UserRole.CLUB_ADMIN)
        result = await svc.submit_for_review(event.id, actor)
        repo.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_published_to_pending_raises(self):
        repo = AsyncMock(spec=EventRepository)
        event = _make_event(EventStatus.PUBLISHED)
        repo.get_event = AsyncMock(return_value=event)

        svc = EventService(repo)
        actor = _make_user(UserRole.CLUB_ADMIN)
        with pytest.raises(BadRequestError):
            await svc.submit_for_review(event.id, actor)

    @pytest.mark.asyncio
    async def test_completed_to_draft_raises(self):
        repo = AsyncMock(spec=EventRepository)
        event = _make_event(EventStatus.COMPLETED)
        repo.get_event = AsyncMock(return_value=event)

        svc = EventService(repo)
        actor = _make_user(UserRole.FACULTY_ADVISOR)
        with pytest.raises(BadRequestError):
            # trying to reject (move to DRAFT) from COMPLETED is invalid
            await svc.reject_event(event.id, "reason", actor)

    @pytest.mark.asyncio
    async def test_approve_requires_faculty_role(self):
        repo = AsyncMock(spec=EventRepository)
        event = _make_event(EventStatus.PENDING_APPROVAL)
        repo.get_event = AsyncMock(return_value=event)

        svc = EventService(repo)
        participant = _make_user(UserRole.PARTICIPANT)
        with pytest.raises(ForbiddenError):
            await svc.approve_event(event.id, participant)

    @pytest.mark.asyncio
    async def test_reject_requires_comment(self):
        repo = AsyncMock(spec=EventRepository)
        event = _make_event(EventStatus.PENDING_APPROVAL)
        repo.get_event = AsyncMock(return_value=event)

        svc = EventService(repo)
        faculty = _make_user(UserRole.FACULTY_ADVISOR)
        with pytest.raises(BadRequestError):
            await svc.reject_event(event.id, "", faculty)

    @pytest.mark.asyncio
    async def test_participant_cannot_create_event(self):
        repo = AsyncMock(spec=EventRepository)
        svc = EventService(repo)
        participant = _make_user(UserRole.PARTICIPANT)
        with pytest.raises(ForbiddenError):
            await svc.create_event({"title": "Test", "organizer_club_id": str(uuid4())}, participant)

    @pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_edit_allowed_in_draft_and_published(self):
        repo = AsyncMock(spec=EventRepository)
        # DRAFT → allowed
        draft_event = _make_event(EventStatus.DRAFT)
        repo.get_event = AsyncMock(return_value=draft_event)
        repo.update = AsyncMock(return_value=draft_event)
        svc = EventService(repo)
        actor = _make_user(UserRole.CLUB_ADMIN)
        result = await svc.update_event(draft_event.id, {"title": "Updated"}, actor)
        assert result is not None

        # PUBLISHED → also allowed now (triggers participant notification)
        pub_event = _make_event(EventStatus.PUBLISHED)
        repo.get_event = AsyncMock(return_value=pub_event)
        repo.update = AsyncMock(return_value=pub_event)
        result = await svc.update_event(pub_event.id, {"venue": "New Venue"}, actor)
        assert result is not None

    @pytest.mark.asyncio
    async def test_edit_blocked_for_archived(self):
        repo = AsyncMock(spec=EventRepository)
        event = _make_event(EventStatus.ARCHIVED)
        repo.get_event = AsyncMock(return_value=event)
        svc = EventService(repo)
        actor = _make_user(UserRole.SUPER_ADMIN)
        with pytest.raises(BadRequestError):
            await svc.update_event(event.id, {"title": "New Title"}, actor)

    @pytest.mark.asyncio
    async def test_delete_requires_super_admin(self):
        repo = AsyncMock(spec=EventRepository)
        event = _make_event()
        repo.get_event = AsyncMock(return_value=event)

        svc = EventService(repo)
        club_admin = _make_user(UserRole.CLUB_ADMIN)
        with pytest.raises(ForbiddenError):
            await svc.delete_event(event.id, club_admin)
