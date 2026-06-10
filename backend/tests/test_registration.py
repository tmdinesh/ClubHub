"""Unit tests for registration module."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.modules.auth.models import User
from app.modules.events.models import Event
from app.modules.events.repos import EventRepository
from app.modules.registration.models import Registration
from app.modules.registration.repos import RegistrationRepository
from app.modules.registration.services import RegistrationService
from app.shared.enums import EventStatus, RegistrationStatus, UserRole
from app.shared.exceptions import BadRequestError, ConflictError


def _make_user() -> User:
    u = User()
    u.id = uuid4()
    u.role = UserRole.PARTICIPANT
    u.email = "student@college.edu"
    u.name = "Student"
    u.is_active = True
    return u


def _make_event(status=EventStatus.PUBLISHED, max_participants=10) -> Event:
    e = Event()
    e.id = uuid4()
    e.status = status
    e.max_participants = max_participants
    e.registration_start = None
    e.registration_end = None
    return e


def _make_registration(status=RegistrationStatus.CONFIRMED) -> Registration:
    r = Registration()
    r.id = uuid4()
    r.event_id = uuid4()
    r.user_id = uuid4()
    r.team_id = None
    r.status = status
    r.registered_at = datetime.now(timezone.utc)
    r.confirmed_at = datetime.now(timezone.utc)
    r.qr_token = "fake.token.here"
    return r


class TestRegistration:
    @pytest.mark.asyncio
    async def test_register_for_closed_event_raises(self):
        reg_repo = AsyncMock(spec=RegistrationRepository)
        event_repo = AsyncMock(spec=EventRepository)
        event = _make_event(status=EventStatus.DRAFT)
        event_repo.get_event = AsyncMock(return_value=event)

        svc = RegistrationService(reg_repo, event_repo)
        user = _make_user()
        with pytest.raises(BadRequestError, match="not open for registration"):
            await svc.register(event.id, user)

    @pytest.mark.asyncio
    async def test_double_registration_raises(self):
        reg_repo = AsyncMock(spec=RegistrationRepository)
        event_repo = AsyncMock(spec=EventRepository)
        event = _make_event()
        event_repo.get_event = AsyncMock(return_value=event)
        existing = _make_registration(RegistrationStatus.CONFIRMED)
        reg_repo.get_by_event_user = AsyncMock(return_value=existing)

        svc = RegistrationService(reg_repo, event_repo)
        user = _make_user()
        user.id = existing.user_id
        with pytest.raises(ConflictError):
            await svc.register(event.id, user)

    @pytest.mark.asyncio
    async def test_waitlist_when_full(self):
        reg_repo = AsyncMock(spec=RegistrationRepository)
        event_repo = AsyncMock(spec=EventRepository)
        event = _make_event(max_participants=5)
        event_repo.get_event = AsyncMock(return_value=event)
        reg_repo.get_by_event_user = AsyncMock(return_value=None)
        reg_repo.count_confirmed = AsyncMock(return_value=5)  # at capacity

        created_reg = _make_registration(RegistrationStatus.WAITLISTED)
        reg_repo.create = AsyncMock(return_value=created_reg)
        reg_repo.update = AsyncMock(return_value=created_reg)

        svc = RegistrationService(reg_repo, event_repo)
        user = _make_user()
        result = await svc.register(event.id, user)
        reg_repo.create.assert_called_once()
        # status passed to create should be WAITLISTED
        call_kwargs = reg_repo.create.call_args[1]
        assert call_kwargs["status"] == RegistrationStatus.WAITLISTED

    @pytest.mark.asyncio
    async def test_cancel_promotes_waitlisted(self):
        reg_repo = AsyncMock(spec=RegistrationRepository)
        event_repo = AsyncMock(spec=EventRepository)

        user = _make_user()
        reg = _make_registration(RegistrationStatus.CONFIRMED)
        reg.user_id = user.id

        waitlisted = _make_registration(RegistrationStatus.WAITLISTED)
        waitlisted.event_id = reg.event_id

        reg_repo.get = AsyncMock(return_value=reg)
        reg_repo.update = AsyncMock(side_effect=lambda r, **kw: r)
        reg_repo.first_waitlisted = AsyncMock(return_value=waitlisted)

        svc = RegistrationService(reg_repo, event_repo)
        await svc.cancel(reg.id, user)

        # update should be called twice: once for cancel, once for promotion
        assert reg_repo.update.call_count == 2
        # second call should set status to CONFIRMED
        second_call_kwargs = reg_repo.update.call_args_list[1][1]
        assert second_call_kwargs["status"] == RegistrationStatus.CONFIRMED
