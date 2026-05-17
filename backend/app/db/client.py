"""
Supabase client factory.
Two clients on purpose:
  - anon_client  → used by the frontend/public endpoints (respects RLS)
  - admin_client → used by server-side ingestion scripts (bypasses RLS via service role)
Never expose admin_client to any request handler reachable from the internet.
"""

from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache(maxsize=1)
def get_admin_client() -> Client:
    """
    For server-to-server ingestion only.
    This key must NEVER be sent to or used by the browser client.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
