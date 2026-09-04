-- Migration: Create payroll_snapshots table for payroll state freezing and version control

CREATE TABLE IF NOT EXISTS public.payroll_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL DEFAULT 'dcel-team',
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  change_reason TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  records JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT uq_payroll_snapshot_version UNIQUE (workspace_id, month, year, version)
);

CREATE INDEX IF NOT EXISTS idx_payroll_snapshots_month_year ON public.payroll_snapshots (workspace_id, year, month, is_active);

-- Enable RLS
ALTER TABLE public.payroll_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists then recreate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payroll_snapshots' AND policyname = 'Allow all authenticated users full access to payroll_snapshots'
  ) THEN
    CREATE POLICY "Allow all authenticated users full access to payroll_snapshots"
    ON public.payroll_snapshots FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payroll_snapshots' AND policyname = 'Allow anon select on payroll_snapshots'
  ) THEN
    CREATE POLICY "Allow anon select on payroll_snapshots"
    ON public.payroll_snapshots FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
