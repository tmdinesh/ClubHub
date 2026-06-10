from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError

# ── Permission definitions ────────────────────────────────────────────────────
# Format: "resource:action"
# Higher roles inherit all permissions of lower roles via ROLE_HIERARCHY.

PERMISSIONS: dict[UserRole, set[str]] = {
    UserRole.PARTICIPANT: {
        "event:read",
        "registration:create",
        "registration:read_own",
        "registration:cancel_own",
        "team:join",
        "team:read",
        "certificate:read_own",
        "certificate:download",
        "feedback:submit",
        "notification:read_own",
    },
    UserRole.ATTENDANCE_TEAM: {
        "attendance:scan",
        "attendance:read",
    },
    UserRole.VOLUNTEER_LEAD: {
        "volunteer:manage",
        "volunteer:read",
    },
    UserRole.FINANCE_LEAD: {
        "finance:manage",
        "finance:read",
    },
    UserRole.EVENT_COORDINATOR: {
        "event:update",
        "registration:read",
        "attendance:read",
        "announcement:create",
    },
    UserRole.EVENT_HEAD: {
        "event:update",
        "event:submit_review",
        "registration:read",
        "team:manage",
        "attendance:manage",
        "certificate:manage",
        "finance:read",
        "feedback:read",
        "analytics:event_read",
        "announcement:create",
    },
    UserRole.CLUB_ADMIN: {
        "event:create",
        "event:update",
        "event:delete",
        "event:submit_review",
        "organizer:assign",
        "analytics:club_read",
        "sponsorship:manage",
    },
    UserRole.FACULTY_ADVISOR: {
        "event:approve",
        "event:reject",
        "event:read",
    },
    UserRole.SUPER_ADMIN: {
        "*",  # wildcard: all permissions
    },
}

# Roles inherit permissions from all roles listed here (ordered by privilege)
ROLE_HIERARCHY: list[UserRole] = [
    UserRole.PARTICIPANT,
    UserRole.ATTENDANCE_TEAM,
    UserRole.VOLUNTEER_LEAD,
    UserRole.FINANCE_LEAD,
    UserRole.EVENT_COORDINATOR,
    UserRole.EVENT_HEAD,
    UserRole.CLUB_ADMIN,
    UserRole.FACULTY_ADVISOR,
    UserRole.SUPER_ADMIN,
]


def _resolve_permissions(role: UserRole) -> set[str]:
    """Collect all permissions for a role, applying simple inheritance."""
    perms: set[str] = set()
    # SUPER_ADMIN is special-cased with wildcard
    if role == UserRole.SUPER_ADMIN:
        return {"*"}
    role_index = ROLE_HIERARCHY.index(role)
    # Inherit from all roles at or below this role's hierarchy level
    for r in ROLE_HIERARCHY[: role_index + 1]:
        perms |= PERMISSIONS.get(r, set())
    return perms


_RESOLVED: dict[UserRole, set[str]] = {r: _resolve_permissions(r) for r in UserRole}


def has_permission(role: UserRole, permission: str) -> bool:
    resolved = _RESOLVED.get(role, set())
    return "*" in resolved or permission in resolved


def require_permission(permission: str) -> Callable[..., Any]:
    """FastAPI dependency factory. Usage: Depends(require_permission('event:create'))."""
    from fastapi import Depends
    from app.modules.auth.deps import get_current_user

    async def _check(current_user: Any = Depends(get_current_user)) -> Any:
        if not has_permission(current_user.role, permission):
            raise ForbiddenError(f"Permission '{permission}' required")
        return current_user

    return _check


def require_role(*roles: UserRole) -> Callable[..., Any]:
    """FastAPI dependency that enforces one of the given roles."""
    from fastapi import Depends
    from app.modules.auth.deps import get_current_user

    async def _check(current_user: Any = Depends(get_current_user)) -> Any:
        if current_user.role not in roles:
            raise ForbiddenError(
                f"Role must be one of: {', '.join(r.value for r in roles)}"
            )
        return current_user

    return _check
