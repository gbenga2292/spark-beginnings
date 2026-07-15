-- ============================================================
-- Migration: chat_receipts_and_cursors
-- Purpose: Upgrade task_updates (chat) to industry-standard
--          messaging architecture with:
--   1. task_participant_status  — High-water mark cursor per user/task
--                                 (same approach as Slack / Discord)
--   2. task_update_receipts     — Per-message delivered/read state
--                                 (same approach as WhatsApp / iMessage)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.task_participant_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_timestamp TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE public.task_participant_status ENABLE ROW LEVEL SECURITY;

-- Teammates can see each other's read cursors (so the UI can compute badges)
CREATE POLICY "task_participant_status_view" ON public.task_participant_status
  FOR SELECT USING (
    ((SELECT (privileges->'tasks'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- Each user can only upsert their own cursor (or admins / managers can)
CREATE POLICY "task_participant_status_upsert" ON public.task_participant_status
  FOR ALL USING (
    auth.uid()::text = user_id
    OR ((SELECT (privileges->'tasks'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_update_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES public.task_updates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('delivered', 'read')),
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(update_id, user_id)
);

ALTER TABLE public.task_update_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_update_receipts_view" ON public.task_update_receipts
  FOR SELECT USING (
    ((SELECT (privileges->'tasks'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

CREATE POLICY "task_update_receipts_manage" ON public.task_update_receipts
  FOR ALL USING (
    auth.uid()::text = user_id
    OR ((SELECT (privileges->'tasks'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- ── Realtime ─────────────────────────────────────────────────
ALTER TABLE public.task_participant_status REPLICA IDENTITY FULL;
ALTER TABLE public.task_update_receipts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'task_participant_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_participant_status;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'task_update_receipts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_update_receipts;
  END IF;
END$$;
