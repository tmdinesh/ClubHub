from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import string
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.modules.attendance.cred_models import EventAttendanceCred
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.events.models import Event
from app.shared.enums import UserRole
from app.shared.exceptions import BadRequestError, ForbiddenError, NotFoundError

router = APIRouter(prefix="/events", tags=["attendance-credentials"])
public_router = APIRouter(tags=["attendance-credentials"])

MAX_CREDS = 10


def _require_club_admin(actor: User = Depends(get_current_user)) -> User:
    if actor.role not in (UserRole.CLUB_ADMIN, UserRole.SUPER_ADMIN):
        raise ForbiddenError("Club Admin required")
    return actor


def _gen_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _hash_password(plain: str) -> str:
    """PBKDF2-SHA256 with a random salt. Format: salt_hex:hash_hex"""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, 260_000)
    return salt.hex() + ":" + dk.hex()


def _verify_password(plain: str, stored: str) -> bool:
    try:
        salt_hex, hash_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, 260_000)
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


# ── Schemas ───────────────────────────────────────────────────────────────────

class CredOut(BaseModel):
    id: str
    event_id: str
    username: str
    label: str
    is_active: bool
    plain_password: str | None = None  # only set right after generation

    model_config = {"from_attributes": False}


class AttendanceLoginRequest(BaseModel):
    username: str
    password: str


class AttendanceTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    event_id: str


# ── Generate credentials ──────────────────────────────────────────────────────

@router.post("/{event_id}/attendance-credentials", response_model=list[CredOut], status_code=201)
async def generate_credentials(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_require_club_admin),
) -> list[CredOut]:
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise NotFoundError("Event", event_id)
    if event.attendance_mode == "MASS":
        raise BadRequestError("Scanner credentials are not used for Mass Attendance events.")

    existing = (await db.execute(
        select(EventAttendanceCred).where(EventAttendanceCred.event_id == event_id)
    )).scalars().all()

    if len(existing) >= MAX_CREDS:
        raise BadRequestError(f"Already have {MAX_CREDS} credentials for this event. Delete some first.")

    to_create = MAX_CREDS - len(existing)
    created: list[CredOut] = []

    for i in range(to_create):
        plain = _gen_password()
        slot = len(existing) + i + 1
        # Use 16 hex chars of the UUID (no hyphens) to guarantee global uniqueness
        # across concurrent events that might share short prefixes
        event_hex = str(event_id).replace("-", "")[:16]
        username = f"att-{event_hex}-{slot:02d}"
        cred = EventAttendanceCred(
            event_id=event_id,
            username=username,
            password_hash=_hash_password(plain),
            label=f"Attendance Taker {slot}",
        )
        db.add(cred)
        await db.flush()
        created.append(CredOut(
            id=str(cred.id),
            event_id=str(cred.event_id),
            username=cred.username,
            label=cred.label,
            is_active=cred.is_active,
            plain_password=plain,
        ))

    return created


@router.get("/{event_id}/attendance-credentials", response_model=list[CredOut])
async def list_credentials(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_require_club_admin),
) -> list[CredOut]:
    rows = (await db.execute(
        select(EventAttendanceCred).where(EventAttendanceCred.event_id == event_id)
    )).scalars().all()
    return [CredOut(
        id=str(r.id), event_id=str(r.event_id),
        username=r.username, label=r.label, is_active=r.is_active,
    ) for r in rows]


@router.delete("/{event_id}/attendance-credentials", status_code=204, response_class=Response, response_model=None)
async def delete_all_credentials(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_require_club_admin),
) -> None:
    rows = (await db.execute(
        select(EventAttendanceCred).where(EventAttendanceCred.event_id == event_id)
    )).scalars().all()
    for r in rows:
        await db.delete(r)
    await db.flush()


# ── Attendance-taker login (no regular JWT needed) ────────────────────────────

@public_router.post("/attendance-login", response_model=AttendanceTokenResponse)
async def attendance_login(
    body: AttendanceLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AttendanceTokenResponse:
    cred = (await db.execute(
        select(EventAttendanceCred).where(
            EventAttendanceCred.username == body.username,
            EventAttendanceCred.is_active == True,
        )
    )).scalar_one_or_none()

    if not cred or not _verify_password(body.password, cred.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    from jose import jwt as jose_jwt
    from datetime import datetime, timezone, timedelta

    payload = {
        "sub": str(cred.id),
        "event_id": str(cred.event_id),
        "role": "ATTENDANCE_TEAM",
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=12)).timestamp()),
    }
    token = jose_jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return AttendanceTokenResponse(access_token=token, event_id=str(cred.event_id))
