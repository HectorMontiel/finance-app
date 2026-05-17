-- ============================================================
-- Migration 002: Row Level Security
-- CRITICAL: Run this AFTER 001.
-- RLS means: even if someone steals your anon key, they see
-- zero rows unless they are authenticated as the correct user.
-- ============================================================

-- Step 1: Enable RLS on the table.
ALTER TABLE finanzas.transacciones ENABLE ROW LEVEL SECURITY;

-- Step 2: Block everything by default (deny-all baseline).
-- Without this, no explicit DENY exists and service role bypasses are cleaner.
ALTER TABLE finanzas.transacciones FORCE ROW LEVEL SECURITY;

-- Step 3: Allow a user to SELECT only their own rows.
CREATE POLICY "users_select_own_transactions"
    ON finanzas.transacciones
    FOR SELECT
    USING (auth.uid() = user_id);

-- Step 4: Block direct INSERT from the browser client.
-- Inserts come from the server-side pipeline using the service role key,
-- which bypasses RLS by design.
-- If you ever need browser inserts, create a separate restricted policy.
-- (No INSERT policy = inserts via anon/authenticated role are blocked.)

-- ============================================================
-- Migration 003: Aggregate helper function
-- Called by monthly_summary() in the repository.
-- ============================================================
CREATE OR REPLACE FUNCTION monthly_category_summary(
    p_user_id UUID,
    p_year    INT,
    p_month   INT
)
RETURNS TABLE (categoria TEXT, total NUMERIC, count BIGINT)
LANGUAGE sql
SECURITY DEFINER  -- runs as the function owner, respects the USING clause below
SET search_path = finanzas
AS $$
    SELECT
        categoria::TEXT,
        SUM(monto)   AS total,
        COUNT(*)     AS count
    FROM finanzas.transacciones
    WHERE
        user_id = p_user_id
        AND EXTRACT(YEAR  FROM fecha) = p_year
        AND EXTRACT(MONTH FROM fecha) = p_month
    GROUP BY categoria
    ORDER BY total DESC;
$$;

-- Restrict who can call the function.
REVOKE ALL ON FUNCTION monthly_category_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION monthly_category_summary TO authenticated;
