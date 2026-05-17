"""
Tests for the AES-256-GCM encryption service.
No mocks — tested against real cryptography primitives.
"""

import os
import pytest

from app.core.encryption import EncryptionService, EncryptionKey, EncryptionKeyError
from app.core.exceptions import AppError

# A valid 64-char hex key for testing (never use in prod).
_TEST_KEY_HEX = "a" * 64
_TEST_KEY_V2_HEX = "b" * 64


@pytest.fixture
def enc(monkeypatch) -> EncryptionService:
    monkeypatch.setenv("ENCRYPTION_KEY", _TEST_KEY_HEX)
    return EncryptionService.from_env()


class TestEncryptDecrypt:
    def test_encrypt_returns_versioned_blob(self, enc):
        blob = enc.encrypt("secret")
        assert blob.startswith("v1:")

    def test_decrypt_recovers_plaintext(self, enc):
        plaintext = "my-refresh-token-xyz"
        assert enc.decrypt(enc.encrypt(plaintext)) == plaintext

    def test_same_plaintext_produces_different_ciphertext(self, enc):
        """Each call must use a fresh nonce."""
        a = enc.encrypt("same")
        b = enc.encrypt("same")
        assert a != b

    def test_tampered_blob_raises(self, enc):
        blob = enc.encrypt("data")
        # Flip a byte in the base64 payload.
        version, b64 = blob.split(":", 1)
        bad_b64 = b64[:-4] + "AAAA"
        from app.core.encryption import DecryptionIntegrityError
        with pytest.raises(DecryptionIntegrityError):
            enc.decrypt(f"{version}:{bad_b64}")

    def test_wrong_version_prefix_raises(self, enc):
        blob = enc.encrypt("data").replace("v1:", "v99:", 1)
        with pytest.raises(EncryptionKeyError):
            enc.decrypt(blob)

    def test_missing_version_prefix_raises(self, enc):
        with pytest.raises(EncryptionKeyError):
            enc.decrypt("no-colon-here")


class TestKeyValidation:
    def test_short_key_raises(self, monkeypatch):
        monkeypatch.setenv("ENCRYPTION_KEY", "tooshort")
        with pytest.raises(EncryptionKeyError):
            EncryptionService.from_env()

    def test_non_hex_key_raises(self, monkeypatch):
        monkeypatch.setenv("ENCRYPTION_KEY", "z" * 64)
        with pytest.raises(EncryptionKeyError):
            EncryptionService.from_env()


class TestKeyRotation:
    def test_re_encrypt_decrypts_with_new_key(self, monkeypatch):
        monkeypatch.setenv("ENCRYPTION_KEY", _TEST_KEY_HEX)
        monkeypatch.setenv("ENCRYPTION_KEY_V2", _TEST_KEY_V2_HEX)

        old_enc = EncryptionService.from_env()
        # Manually encrypt with old key (v1 is active at this point).
        old_blob = old_enc.encrypt("rotate-me")

        # Simulate rotation: v2 becomes active.
        # Build new service where v2 is active.
        k1 = EncryptionKey(version="v1", raw=bytes.fromhex(_TEST_KEY_HEX))
        k2 = EncryptionKey(version="v2", raw=bytes.fromhex(_TEST_KEY_V2_HEX))
        new_enc = EncryptionService(keys={"v1": k1, "v2": k2}, active_version="v2")

        new_blob = new_enc.re_encrypt(old_blob)
        assert new_blob.startswith("v2:")
        assert new_enc.decrypt(new_blob) == "rotate-me"
