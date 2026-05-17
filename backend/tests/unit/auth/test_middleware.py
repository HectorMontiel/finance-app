"""
Unit tests for JWT middleware.
No network calls — jwt.encode() creates real tokens so we test the full decode path.
"""

import time

import jwt
import pytest

from app.auth.middleware import extract_bearer_token, validate_supabase_jwt
from app.core.exceptions import AuthTokenExpiredError, AuthTokenInvalidError, AuthTokenMissingError

_SECRET = "test-secret-at-least-32-chars-long!"
_USER_ID = "550e8400-e29b-41d4-a716-446655440000"
_EMAIL = "hector@example.com"


def _make_token(extra: dict | None = None, secret: str = _SECRET) -> str:
    payload = {
        "sub": _USER_ID,
        "email": _EMAIL,
        "exp": int(time.time()) + 3600,
        **(extra or {}),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


class TestValidateSupabaseJWT:
    def test_valid_token_returns_user(self):
        token = _make_token()
        user = validate_supabase_jwt(token, _SECRET)
        assert str(user.id) == _USER_ID
        assert user.email == _EMAIL

    def test_empty_token_raises_missing(self):
        with pytest.raises(AuthTokenMissingError):
            validate_supabase_jwt("", _SECRET)

    def test_expired_token_raises_expired(self):
        token = _make_token({"exp": int(time.time()) - 1})
        with pytest.raises(AuthTokenExpiredError):
            validate_supabase_jwt(token, _SECRET)

    def test_wrong_secret_raises_invalid(self):
        token = _make_token(secret="wrong-secret-xxxxxxxxxxxxxxxxxx!")
        with pytest.raises(AuthTokenInvalidError):
            validate_supabase_jwt(token, _SECRET)


class TestExtractBearerToken:
    def test_valid_header(self):
        assert extract_bearer_token("Bearer abc123") == "abc123"

    def test_missing_header_raises(self):
        with pytest.raises(AuthTokenMissingError):
            extract_bearer_token(None)

    def test_malformed_scheme_raises(self):
        with pytest.raises(AuthTokenInvalidError):
            extract_bearer_token("Token abc123")
