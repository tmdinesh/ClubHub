from __future__ import annotations

from typing import Any


class AppException(Exception):
    """Base exception for all application errors."""

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str = "An unexpected error occurred", detail: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


class NotFoundError(AppException):
    status_code = 404
    error_code = "NOT_FOUND"

    def __init__(self, resource: str = "Resource", resource_id: Any = None) -> None:
        msg = f"{resource} not found"
        if resource_id is not None:
            msg += f": {resource_id}"
        super().__init__(msg)


class UnauthorizedError(AppException):
    status_code = 401
    error_code = "UNAUTHORIZED"

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(message)


class ForbiddenError(AppException):
    status_code = 403
    error_code = "FORBIDDEN"

    def __init__(self, message: str = "You do not have permission to perform this action") -> None:
        super().__init__(message)


class ConflictError(AppException):
    status_code = 409
    error_code = "CONFLICT"

    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(message)


class ValidationError(AppException):
    status_code = 422
    error_code = "VALIDATION_ERROR"

    def __init__(self, message: str = "Validation failed", detail: Any = None) -> None:
        super().__init__(message, detail)


class BadRequestError(AppException):
    status_code = 400
    error_code = "BAD_REQUEST"

    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(message)
