"""
FastAPI dependency functions.
Using Depends() injects the authenticated user into any endpoint that needs it.
No endpoint touches JWT logic directly — this is the single entry point.
"""

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.middleware import validate_supabase_jwt
from app.config import Settings, get_settings
from app.models.user import AuthenticatedUser

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """
    Resolves to the authenticated user or raises 401.
    Inject with:  current_user: AuthenticatedUser = Depends(get_current_user)
    """
    token = credentials.credentials if credentials else None
    return validate_supabase_jwt(token or "", settings.supabase_jwt_secret)
