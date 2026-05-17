"""
Key Rotation Service — migrates all encrypted tokens to the new active key.

When to rotate:
  1. Set ENCRYPTION_KEY_V2 = new key in your env vars (keep old ENCRYPTION_KEY for now).
  2. Run this service once (via a one-off script or admin endpoint).
  3. Remove old ENCRYPTION_KEY, rename V2 → ENCRYPTION_KEY.

This guarantees zero downtime: old rows still decrypt during the migration window.
"""

from uuid import UUID

from supabase import Client

from app.core.encryption import EncryptionService
from app.core.logging import get_logger
from app.core.token_vault import TokenVault

_logger = get_logger(__name__)
_TABLE = "token_vault"


class KeyRotationService:
    def __init__(self, db: Client, encryption: EncryptionService) -> None:
        self._db = db
        self._enc = encryption
        self._vault = TokenVault(db, encryption)

    def rotate_all_tokens(self) -> dict[str, int]:
        """
        Re-encrypt every row in token_vault with the current active key.
        Returns a summary: {"rotated": N, "failed": M}
        """
        rows = self._fetch_all_rows()
        rotated = 0
        failed = 0

        for row in rows:
            try:
                new_blob = self._enc.re_encrypt(row["encrypted_token"])
                self._db.table(_TABLE).update({"encrypted_token": new_blob}).eq(
                    "id", row["id"]
                ).execute()
                rotated += 1
            except Exception as exc:
                _logger.error("rotation_failed", row_id=row["id"], error=type(exc).__name__)
                failed += 1

        _logger.info("rotation_complete", rotated=rotated, failed=failed)
        return {"rotated": rotated, "failed": failed}

    def _fetch_all_rows(self) -> list[dict]:
        try:
            result = self._db.table(_TABLE).select("id, encrypted_token").execute()
            return result.data or []
        except Exception as exc:
            _logger.error("rotation_fetch_failed", error=str(exc))
            return []
