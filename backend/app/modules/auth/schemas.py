from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.shared.enums import UserRole


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    avatar_url: str | None
    role: UserRole
    department: str | None
    year: int | None
    roll_number: str | None = None
    bank_account_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    is_active: bool
    last_login: datetime | None
    created_at: datetime
    club_id: UUID | None = None

    model_config = {"from_attributes": True}


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class SuperAdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminUserCreate(BaseModel):
    email: EmailStr
    name: str
    role: UserRole
    club_id: UUID | None = None


class AdminUserUpdate(BaseModel):
    role: UserRole | None = None
    club_id: UUID | None = None
    is_active: bool | None = None


class AdminClubUpdate(BaseModel):
    faculty_advisor_id: UUID | None
