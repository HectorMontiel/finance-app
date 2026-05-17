"""
Shared fixtures — available to all test files automatically.
"""

import os
import pytest

# Prevent tests from ever reading a real .env file.
# All config values needed by tests are set here or in individual test modules.
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long!")
os.environ.setdefault("GMAIL_CLIENT_ID", "test-client-id")
os.environ.setdefault("GMAIL_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("MP_ACCESS_TOKEN", "test-mp-token")
