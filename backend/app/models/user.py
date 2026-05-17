"""
User model — only what the app needs post-authentication.
We never store the password; Supabase Auth owns that.
"""

from uuid import UUID
from pydantic import BaseModel, EmailStr


class AuthenticatedUser(BaseModel):
    id: UUID
    email: EmailStr

    model_config = {"frozen": True}
