-- ============================================================
-- Migration 003: Token Vault
-- Stores OAuth2 refresh tokens and API keys encrypted at rest.
-- The encrypted_token column only contains AES-256-GCM blobs;
-- the plaintext never lands in the database.
-- ============================================================

CREATE TABLE finanzas.token_vault (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- e.g. 'gmail_oauth2', 'mercadopago', 'nu', 'rappicard'
    service         TEXT        NOT NULL,
    -- Format: "v1:<base64(nonce + tag + ciphertext)>"
    -- The version prefix allows zero-downtime key rotation.
    encrypted_token TEXT        NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_vault_user_service UNIQUE (user_id, service)
);

-- Automatically update updated_at on every write.
CREATE OR REPLACE FUNCTION finanzas.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER token_vault_updated_at
    BEFORE UPDATE ON finanzas.token_vault
    FOR EACH ROW EXECUTE FUNCTION finanzas.set_updated_at();

-- ============================================================
-- RLS on token_vault
-- ============================================================
ALTER TABLE finanzas.token_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.token_vault FORCE ROW LEVEL SECURITY;

-- Users can only SELECT their own tokens.
-- (Writes come from the server via service role key — no INSERT policy needed.)
CREATE POLICY "users_select_own_tokens"
    ON finanzas.token_vault
    FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================
-- Audit log for vault access (optional but recommended)
-- Helps detect unexpected token reads in prod.
-- ============================================================
CREATE TABLE finanzas.vault_access_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    service     TEXT        NOT NULL,
    action      TEXT        NOT NULL CHECK (action IN ('store', 'retrieve', 'rotate')),
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log: append-only (no UPDATE, no DELETE).
ALTER TABLE finanzas.vault_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.vault_access_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_audit_log"
    ON finanzas.vault_access_log
    FOR SELECT
    USING (auth.uid() = user_id);
