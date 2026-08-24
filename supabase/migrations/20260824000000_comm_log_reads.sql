-- ============================================================
-- Migration: comm_log_reads
-- Purpose: Track per-user read status and collaborative read receipts
--          for communication logs (WhatsApp-style receipts)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comm_log_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES public.comm_logs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(log_id, user_id)
);

ALTER TABLE public.comm_log_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'comm_log_reads' 
    AND policyname = 'comm_log_reads_view'
  ) THEN
    CREATE POLICY "comm_log_reads_view" ON public.comm_log_reads FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'comm_log_reads' 
    AND policyname = 'comm_log_reads_upsert'
  ) THEN
    CREATE POLICY "comm_log_reads_upsert" ON public.comm_log_reads FOR ALL USING (true);
  END IF;
END$$;

ALTER TABLE public.comm_log_reads REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'comm_log_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_log_reads;
  END IF;
END$$;
