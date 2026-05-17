"""
JWT validation middleware for Supabase tokens.
Flow: Bearer token → decode with JWT secret → extract sub + email → AuthenticatedUser
Fails fast with typed exceptions that the global error handler converts to HTTP responses.
"""

import jwt
from jwt.exceptions import DecodeError, ExpiredSignatureError

from app.core.exceptions import (
    AuthTokenExpiredError,
    AuthTokenInvalidError,
    AuthTokenMissingError,
)
from app.core.logging import get_logger
from app.models.user import AuthenticatedUser

_logger = get_logger(__name__)

_SUPABASE_ALGORITHM = "HS256"
_REQUIRED_CLAIMS = {"sub", "email", "exp"}


def validate_supabase_jwt(token: str, jwt_secret: str) -> AuthenticatedUser:
    """
    Decode and validate a Supabase-issued JWT.
    Returns AuthenticatedUser on success; raises a typed AppError on failure.
    """
    if not token:
        raise AuthTokenMissingError()

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=[_SUPABASE_ALGORITHM],
            options={"require": list(_REQUIRED_CLAIMS)},
        )
    except ExpiredSignatureError:
        _logger.warning("jwt_expired")
        raise AuthTokenExpiredError()
    except DecodeError as exc:
        _logger.warning("jwt_decode_failed", error=str(exc))
        raise AuthTokenInvalidError(detail=str(exc))

    return AuthenticatedUser(id=payload["sub"], email=payload["email"])


def extract_bearer_token(authorization_header: str | None) -> str:
    """
    Parse the raw Authorization header value.
    Expects: 'Bearer <token>'
    """
    if not authorization_header:
        raise AuthTokenMissingError()

    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthTokenInvalidError(detail="Malformed Authorization header")

    return parts[1]
