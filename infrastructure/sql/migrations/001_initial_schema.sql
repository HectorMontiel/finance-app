-- ============================================================
-- Migration 001: Initial schema
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- Enum types keep category values validated at the DB level.
CREATE TYPE transaction_source AS ENUM (
    'santander', 'mercado_pago', 'nu', 'rappicard'
);

CREATE TYPE transaction_category AS ENUM (
    'food', 'transport', 'entertainment', 'health',
    'utilities', 'shopping', 'transfer', 'other'
);

CREATE TABLE finanzas.transacciones (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha       TIMESTAMPTZ     NOT NULL,
    monto       NUMERIC(12, 2)  NOT NULL CHECK (monto > 0),
    concepto    TEXT            NOT NULL,
    fuente      transaction_source NOT NULL,
    categoria   transaction_category NOT NULL DEFAULT 'other',
    -- SHA-256 of the source-specific unique string.
    -- Prevents duplicates without storing raw email/API data.
    raw_id      TEXT            NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index for the most common query pattern: user + date range.
CREATE INDEX idx_transacciones_user_fecha
    ON finanzas.transacciones (user_id, fecha DESC);

-- Index for the summary grouping.
CREATE INDEX idx_transacciones_user_categoria
    ON finanzas.transacciones (user_id, categoria);
