"""
Token Vault — stores and retrieves OAuth2/API tokens encrypted at rest.

Problem it solves:
  If your Supabase DB were ever compromised, raw tokens would give an attacker
  full access to Gmail + Mercado Pago on your behalf.
  With the vault, stolen DB rows are useless without the ENCRYPTION_KEY,
  which lives only in Render/Railway env vars — never in the database.

Flow:
  Write: plaintext token → encrypt() → store encrypted blob in DB
  Read:  fetch blob from DB → decrypt() → use token in API call → discard

The vault table uses RLS: only the owning user_id can read their own tokens.
"""

from uuid import UUID

from supabase import Client

from app.core.encryption import EncryptionService
from app.core.exceptions import AppError, ExternalServiceError
from app.core.logging import get_logger

_logger = get_logger(__name__)
_TABLE = "token_vault"


class TokenNotFoundError(AppError):
    def __init__(self, service: str) -> None:
        super().__init__(
            public_message=f"Token for '{service}' not configured.",
            status_code=404,
        )


class TokenVault:
    """
    Encrypt-before-write, decrypt-after-read token store.
    All tokens are encrypted with AES-256-GCM before touching the database.
    """

    def __init__(self, db: Client, encryption: EncryptionService) -> None:
        self._db = db
        self._enc = encryption

    def store(self, user_id: UUID, service: str, token: str) -> None:
        """Encrypt token and upsert into the vault."""
        encrypted_blob = self._enc.encrypt(token)
        try:
            self._db.schema("finanzas").table(_TABLE).upsert(
                {
                    "user_id": str(user_id),
                    "service": service,
                    "encrypted_token": encrypted_blob,
                },
                on_conflict="user_id,service",
            ).execute()
            _logger.info("token_stored", service=service)
        except Exception as exc:
            raise ExternalServiceError("supabase", detail=str(exc)) from exc

    def retrieve(self, user_id: UUID, service: str) -> str:
        """Fetch and decrypt token. Raises TokenNotFoundError if absent."""
        try:
            result = (
                self._db.schema("finanzas").table(_TABLE)
                .select("encrypted_token")
                .eq("user_id", str(user_id))
                .eq("service", service)
                .single()
                .execute()
            )
        except Exception as exc:
            raise ExternalServiceError("supabase", detail=str(exc)) from exc

        if not result.data:
            raise TokenNotFoundError(service)

        encrypted_blob: str = result.data["encrypted_token"]
        return self._enc.decrypt(encrypted_blob)

    def rotate(self, user_id: UUID, service: str) -> None:
        """
        Re-encrypt an existing token with the current active key.
        Call this during key rotation for each stored token.
        """
        old_blob = self._retrieve_raw(user_id, service)
        new_blob = self._enc.re_encrypt(old_blob)
        try:
            self._db.table(_TABLE).update({"encrypted_token": new_blob}).eq(
                "user_id", str(user_id)
            ).eq("service", service).execute()
            _logger.info("token_rotated", service=service)
        except Exception as exc:
            raise ExternalServiceError("supabase", detail=str(exc)) from exc

    def _retrieve_raw(self, user_id: UUID, service: str) -> str:
        try:
            result = (
                self._db.schema("finanzas").table(_TABLE)
                .select("encrypted_token")
                .eq("user_id", str(user_id))
                .eq("service", service)
                .single()
                .execute()
            )
        except Exception as exc:
            raise ExternalServiceError("supabase", detail=str(exc)) from exc

        if not result.data:
            raise TokenNotFoundError(service)
        return result.data["encrypted_token"]
