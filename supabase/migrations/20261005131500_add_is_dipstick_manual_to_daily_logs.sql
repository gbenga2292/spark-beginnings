-- Migration: Add is_dipstick_manual to operations_daily_logs
-- Ensures only verified manual readings act as telemetry anchors for future forecasts

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'operations_daily_logs') THEN
    ALTER TABLE public.operations_daily_logs 
      ADD COLUMN IF NOT EXISTS is_dipstick_manual BOOLEAN DEFAULT true;
    COMMENT ON COLUMN public.operations_daily_logs.is_dipstick_manual IS 'True if dipstick level was physically measured, false if auto-calculated/estimated';
  END IF;
END $$;
