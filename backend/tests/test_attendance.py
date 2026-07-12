"""Unit tests for attendance module."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from jose import jwt

from app.core.config import settings
from app.main import app
from app.modules.attendance.models import AttendanceRecord, Checkpoint
from app.modules.attendance.repos import AttendanceRepository
from app.modules.attendance.services import AttendanceService
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.registration.models import Registration
from app.modules.registration.repos import RegistrationRepository
from app.shared.enums import RegistrationStatus, UserRole
from app.shared.exceptions import BadRequestError, UnauthorizedError


def _make_qr_token(reg_id: str, event_id: str) -> str:
    payload = {"reg_id": reg_id, "event_id": event_id, "iat": 1}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _make_scanner() -> User:
    u = User()
    u.id = uuid4()
    u.role = UserRole.ATTENDANCE_TEAM
    return u


class TestAttendanceScan:
    @pytest.mark.asyncio
    async def test_invalid_qr_raises(self):
        att_repo = AsyncMock(spec=AttendanceRepository)
        reg_repo = AsyncMock(spec=RegistrationRepository)
        svc = AttendanceService(att_repo, reg_repo)
        scanner = _make_scanner()
        with pytest.raises(UnauthorizedError):
            await svc.scan("not.a.valid.token", uuid4(), scanner)

    @pytest.mark.asyncio
    async def test_unconfirmed_registration_raises(self):
        att_repo = AsyncMock(spec=AttendanceRepository)
        reg_repo = AsyncMock(spec=RegistrationRepository)

        reg = Registration()
        reg.id = uuid4()
        reg.status = RegistrationStatus.WAITLISTED
        reg_repo.get = AsyncMock(return_value=reg)

        svc = AttendanceService(att_repo, reg_repo)
        scanner = _make_scanner()
        token = _make_qr_token(str(reg.id), str(uuid4()))

        with pytest.raises(BadRequestError, match="not confirmed"):
            await svc.scan(token, uuid4(), scanner)

    @pytest.mark.asyncio
    async def test_duplicate_scan_returns_is_duplicate_true(self):
        att_repo = AsyncMock(spec=AttendanceRepository)
        reg_repo = AsyncMock(spec=RegistrationRepository)

        reg = Registration()
        reg.id = uuid4()
        reg.status = RegistrationStatus.CONFIRMED
        reg_repo.get = AsyncMock(return_value=reg)

        cp = Checkpoint()
        cp.id = uuid4()
        att_repo.get_checkpoint = AsyncMock(return_value=cp)

        existing_record = AttendanceRecord()
        existing_record.id = uuid4()
        att_repo.existing_record = AsyncMock(return_value=existing_record)

        svc = AttendanceService(att_repo, reg_repo)
        scanner = _make_scanner()
        token = _make_qr_token(str(reg.id), str(uuid4()))

        with patch("app.modules.attendance.services.get_redis_client") as mock_redis_factory:
            mock_redis = AsyncMock()
            mock_redis.set = AsyncMock(return_value=True)  # lock acquired
            mock_redis.delete = AsyncMock(return_value=True)
            mock_redis_factory.return_value = mock_redis

            result = await svc.scan(token, cp.id, scanner)

        assert result["is_duplicate"] is True
        att_repo.create_record.assert_not_called()

    @pytest.mark.asyncio
    async def test_first_scan_creates_record(self):
        att_repo = AsyncMock(spec=AttendanceRepository)
        reg_repo = AsyncMock(spec=RegistrationRepository)

        reg = Registration()
        reg.id = uuid4()
        reg.status = RegistrationStatus.CONFIRMED
        reg_repo.get = AsyncMock(return_value=reg)

        cp = Checkpoint()
        cp.id = uuid4()
        att_repo.get_checkpoint = AsyncMock(return_value=cp)
        att_repo.existing_record = AsyncMock(return_value=None)  # no prior record

        new_record = AttendanceRecord()
        new_record.id = uuid4()
        att_repo.create_record = AsyncMock(return_value=new_record)

        svc = AttendanceService(att_repo, reg_repo)
        scanner = _make_scanner()
        token = _make_qr_token(str(reg.id), str(uuid4()))

        with patch("app.modules.attendance.services.get_redis_client") as mock_redis_factory:
            mock_redis = AsyncMock()
            mock_redis.set = AsyncMock(return_value=True)
            mock_redis.delete = AsyncMock(return_value=True)
            mock_redis_factory.return_value = mock_redis

            result = await svc.scan(token, cp.id, scanner)

        assert result["is_duplicate"] is False
        att_repo.create_record.assert_called_once()


def _make_attendance_user(role: UserRole = UserRole.PARTICIPANT) -> User:
    from uuid import uuid4
    u = User()
    u.id = uuid4()
    u.role = role
    u.email = "test@test.com"
    u.name = "Test"
    u.is_active = True
    u.club_id = None
    return u


class TestAttendanceRouteAuth:
    @pytest.mark.asyncio
    async def test_dashboard_requires_auth(self, client: AsyncClient):
        response = await client.get("/events/00000000-0000-0000-0000-000000000001/attendance")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_dashboard_rejects_participant(self, client: AsyncClient):
        app.dependency_overrides[get_current_user] = lambda: _make_attendance_user(UserRole.PARTICIPANT)
        try:
            response = await client.get("/events/00000000-0000-0000-0000-000000000001/attendance")
            assert response.status_code == 403
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_checkpoint_stats_requires_auth(self, client: AsyncClient):
        response = await client.get(
            "/events/00000000-0000-0000-0000-000000000001/attendance/checkpoint/00000000-0000-0000-0000-000000000002"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_export_csv_requires_auth(self, client: AsyncClient):
        response = await client.get("/events/00000000-0000-0000-0000-000000000001/attendance/export")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_checkpoints_requires_auth(self, client: AsyncClient):
        response = await client.get("/events/00000000-0000-0000-0000-000000000001/checkpoints")
        assert response.status_code == 401
