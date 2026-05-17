"""
AES-256-GCM encryption service.

Why AES-256-GCM:
  - AES-256: 256-bit key, computationally infeasible to brute-force.
  - GCM mode: Authenticated encryption — detects tampering (integrity check built in).
    If a byte in the ciphertext is flipped, decryption raises an error instead of
    returning garbage silently.
  - Each encrypt call generates a fresh 12-byte nonce so the same plaintext
    produces a different ciphertext every time (semantic security).

Layout of stored bytes: [ nonce (12) | tag (16) | ciphertext (variable) ]
Everything is base64-encoded before storage so it's safe in text columns.

Key derivation:
  - The raw ENCRYPTION_KEY env var is a hex string (64 chars = 32 bytes).
  - Key rotation: bump ENCRYPTION_KEY_VERSION and store the new key.
    Old rows keep their version prefix so the correct key is always used for decryption.

NEVER log the key, nonce, plaintext, or decrypted value.
"""

import base64
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.exceptions import AppError
from app.core.logging import get_logger

_logger = get_logger(__name__)

_NONCE_SIZE = 12  # bytes — NIST recommended for GCM
_TAG_SIZE = 16    # bytes — GCM authentication tag (appended automatically by cryptography lib)
_VERSION_PREFIX_LEN = 3  # e.g. "v1:" prefix stored with ciphertext


class EncryptionKeyError(AppError):
    def __init__(self, detail: str = "") -> None:
        super().__init__(
            public_message="Encryption configuration error.",
            internal_detail=detail,
            status_code=500,
        )


class DecryptionIntegrityError(AppError):
    def __init__(self) -> None:
        super().__init__(
            public_message="Data integrity check failed.",
            internal_detail="GCM tag mismatch — possible tampering detected.",
            status_code=500,
        )


@dataclass(frozen=True)
class EncryptionKey:
    version: str   # e.g. "v1"
    raw: bytes     # 32 bytes

    @classmethod
    def from_env(cls, env_var: str = "ENCRYPTION_KEY", version: str = "v1") -> "EncryptionKey":
        hex_key = os.environ.get(env_var, "")
        if len(hex_key) != 64:
            raise EncryptionKeyError(
                detail=f"{env_var} must be a 64-char hex string (32 bytes). "
                       f"Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        try:
            raw = bytes.fromhex(hex_key)
        except ValueError as exc:
            raise EncryptionKeyError(detail=f"{env_var} is not valid hex: {exc}") from exc
        return cls(version=version, raw=raw)


class EncryptionService:
    """
    Stateless encryption/decryption service.
    Supports multiple key versions for zero-downtime key rotation.

    Usage:
        svc = EncryptionService.from_env()
        token = svc.encrypt("my-secret-token")   # → "v1:<base64>"
        plain = svc.decrypt(token)               # → "my-secret-token"
    """

    def __init__(self, keys: dict[str, EncryptionKey], active_version: str) -> None:
        if active_version not in keys:
            raise EncryptionKeyError(detail=f"Active version '{active_version}' not in keys dict.")
        self._keys = keys
        self._active_version = active_version

    @classmethod
    def from_env(cls) -> "EncryptionService":
        """
        Load key(s) from environment variables.
        Add ENCRYPTION_KEY_V2 / ENCRYPTION_KEY_V2_VERSION when rotating.
        """
        active = EncryptionKey.from_env("ENCRYPTION_KEY", version="v1")
        keys: dict[str, EncryptionKey] = {active.version: active}

        # Optional second key for rotation (old rows still decrypt with v1)
        if os.environ.get("ENCRYPTION_KEY_V2"):
            v2 = EncryptionKey.from_env("ENCRYPTION_KEY_V2", version="v2")
            keys[v2.version] = v2

        return cls(keys=keys, active_version=active.version)

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext and return a versioned base64 string.
        Format: "v1:<base64(nonce + tag + ciphertext)>"
        """
        key = self._keys[self._active_version]
        aesgcm = AESGCM(key.raw)
        nonce = os.urandom(_NONCE_SIZE)
        # AESGCM.encrypt appends the 16-byte GCM tag to the ciphertext automatically.
        ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext.encode(), associated_data=None)
        blob = base64.b64encode(nonce + ciphertext_with_tag).decode()
        return f"{key.version}:{blob}"

    def decrypt(self, versioned_blob: str) -> str:
        """
        Decrypt a versioned blob. Automatically selects the correct key by version prefix.
        Raises DecryptionIntegrityError if the GCM tag check fails (data was tampered with).
        """
        try:
            version, b64 = versioned_blob.split(":", 1)
        except ValueError as exc:
            raise EncryptionKeyError(detail="Blob missing version prefix.") from exc

        if version not in self._keys:
            raise EncryptionKeyError(detail=f"Unknown key version '{version}'.")

        key = self._keys[version]
        raw_bytes = base64.b64decode(b64)
        nonce = raw_bytes[:_NONCE_SIZE]
        ciphertext_with_tag = raw_bytes[_NONCE_SIZE:]

        aesgcm = AESGCM(key.raw)
        try:
            plaintext_bytes = aesgcm.decrypt(nonce, ciphertext_with_tag, associated_data=None)
        except Exception:
            # cryptography raises InvalidTag on GCM mismatch.
            # We catch broadly and raise our own typed error — never leak the original exception.
            _logger.error("decryption_integrity_failure", key_version=version)
            raise DecryptionIntegrityError()

        return plaintext_bytes.decode()

    def re_encrypt(self, old_blob: str) -> str:
        """
        Decrypt with old key, re-encrypt with current active key.
        Use during key rotation to migrate existing rows.
        """
        plaintext = self.decrypt(old_blob)
        return self.encrypt(plaintext)
