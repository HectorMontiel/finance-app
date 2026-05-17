"""
Central configuration — single source of truth for all env vars.
Pydantic-settings validates types at startup; the app crashes fast with a
clear message instead of silently misbehaving at runtime.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- Supabase ---
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # --- Encryption ---
    encryption_key: str

    # --- Gmail OAuth2 ---
    gmail_client_id: str
    gmail_client_secret: str
    gmail_token_path: str = "./token.json"

    # --- Mercado Pago ---
    mp_access_token: str = "pendiente"

    # --- App ---
    app_env: str = "production"
    log_level: str = "INFO"
    allowed_origins: list[str] = ["http://localhost:8501"]

    # --- Runtime user (pipeline / setup scripts) ---
    finance_user_id: str = ""

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton — read env vars once, reuse everywhere."""
    return Settings()
