"""
Domain-specific exceptions.
Naming convention: <Context><Problem>Error
Each carries a user-safe message (no PII/stack traces) and an internal detail
that only lands in structured logs — never in HTTP responses.
"""

from dataclasses import dataclass, field


@dataclass
class AppError(Exception):
    public_message: str
    internal_detail: str = field(default="", repr=False)
    status_code: int = field(default=500, repr=False)


class AuthTokenMissingError(AppError):
    def __init__(self) -> None:
        super().__init__(
            public_message="Authorization token required.",
            status_code=401,
        )


class AuthTokenInvalidError(AppError):
    def __init__(self, detail: str = "") -> None:
        super().__init__(
            public_message="Token is invalid or expired.",
            internal_detail=detail,
            status_code=401,
        )


class AuthTokenExpiredError(AppError):
    def __init__(self) -> None:
        super().__init__(
            public_message="Token has expired. Please log in again.",
            status_code=401,
        )


class TransactionNotFoundError(AppError):
    def __init__(self, transaction_id: str) -> None:
        super().__init__(
            public_message="Transaction not found.",
            internal_detail=f"id={transaction_id}",
            status_code=404,
        )


class DuplicateTransactionError(AppError):
    def __init__(self, raw_id: str) -> None:
        super().__init__(
            public_message="Transaction already exists.",
            internal_detail=f"raw_id={raw_id}",
            status_code=409,
        )


class ExternalServiceError(AppError):
    def __init__(self, service: str, detail: str = "") -> None:
        super().__init__(
            public_message=f"External service '{service}' is unavailable.",
            internal_detail=detail,
            status_code=502,
        )
