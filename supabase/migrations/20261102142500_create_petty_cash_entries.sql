-- Migration: Create petty_cash_entries table and add petty_cash_banks config to app_settings
-- Created: 2026-11-02
-- Description: Stores Petty Cash Money-In replenishment transactions and configured Ledger Paid-From accounts classified as Petty Cash.

CREATE TABLE IF NOT EXISTS public.petty_cash_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    paid_from TEXT NOT NULL DEFAULT '',
    paid_to TEXT NOT NULL DEFAULT '',
    entered_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_date ON public.petty_cash_entries(date DESC);

ALTER TABLE public.petty_cash_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'petty_cash_entries' AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users"
            ON public.petty_cash_entries FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

ALTER TABLE public.app_settings
    ADD COLUMN IF NOT EXISTS petty_cash_banks JSONB DEFAULT '["Petty Cash"]'::jsonb;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE petty_cash_entries;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;

