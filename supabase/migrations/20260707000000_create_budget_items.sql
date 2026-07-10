-- Budget Items Table
-- Source: 'manual' (added by hand) | 'task' (auto-created on subtask approval)
-- Status: 'pending' → 'budgeted' → 'settled'

CREATE TABLE IF NOT EXISTS budget_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        text NOT NULL,
  title               text NOT NULL,
  week_label          text NOT NULL,          -- e.g. "Week 27 · Jul 2026"
  week_start          date NOT NULL,          -- ISO Monday of the week
  requested           numeric NOT NULL DEFAULT 0,
  budgeted            numeric,                -- set by accounts dept
  linked_ledger_ids   text[] NOT NULL DEFAULT '{}',
  source              text NOT NULL DEFAULT 'manual',
  subtask_id          text,
  main_task_id        text,
  status              text NOT NULL DEFAULT 'pending',
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_workspace ON budget_items (workspace_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_week ON budget_items (workspace_id, week_start);

ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Policy: workspace isolation using the app-set config value
DROP POLICY IF EXISTS "workspace_isolation_budget" ON budget_items;
CREATE POLICY "workspace_isolation_budget" ON budget_items
  USING (workspace_id = current_setting('app.workspace_id', true));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_budget_items_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_items_updated_at ON budget_items;
CREATE TRIGGER trg_budget_items_updated_at
  BEFORE UPDATE ON budget_items
  FOR EACH ROW EXECUTE FUNCTION update_budget_items_updated_at();

-- Enable realtime for live sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND tablename = 'budget_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE budget_items;
  END IF;
END $$;

-- Alter subtasks and main_tasks tables to support budget request details
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS has_budget boolean DEFAULT false;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS budget_requested numeric;

ALTER TABLE main_tasks ADD COLUMN IF NOT EXISTS has_budget boolean DEFAULT false;
ALTER TABLE main_tasks ADD COLUMN IF NOT EXISTS budget_requested numeric;

