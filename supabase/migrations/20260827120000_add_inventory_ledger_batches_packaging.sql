-- Add packaging and batches columns to operations_assets
ALTER TABLE public.operations_assets 
ADD COLUMN IF NOT EXISTS pack_unit TEXT,
ADD COLUMN IF NOT EXISTS pack_size NUMERIC,
ADD COLUMN IF NOT EXISTS has_expiry BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS batches JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Create operations_asset_movements table for unified immutable ledger
CREATE TABLE IF NOT EXISTS public.operations_asset_movements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  asset_id TEXT REFERENCES public.operations_assets(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  movement_date DATE,
  quantity_delta NUMERIC NOT NULL,
  previous_quantity NUMERIC NOT NULL,
  new_quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  reason_code TEXT,
  reference_id TEXT,
  reference_type TEXT,
  site_id TEXT,
  site_name TEXT,
  batch_id TEXT,
  batch_number TEXT,
  actor_id UUID,
  actor_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for high-performance audit and ledger querying
CREATE INDEX IF NOT EXISTS idx_ops_asset_movements_asset_id ON public.operations_asset_movements(asset_id);
CREATE INDEX IF NOT EXISTS idx_ops_asset_movements_created_at ON public.operations_asset_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_asset_movements_type ON public.operations_asset_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_ops_asset_movements_site_id ON public.operations_asset_movements(site_id);

-- RLS Policies
ALTER TABLE public.operations_asset_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'operations_asset_movements' AND policyname = 'operations_asset_movements view access'
  ) THEN
    CREATE POLICY "operations_asset_movements view access" 
    ON public.operations_asset_movements FOR SELECT 
    USING (
      ((SELECT (privileges->'opsInventory'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) 
      OR public.is_admin()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'operations_asset_movements' AND policyname = 'operations_asset_movements manage access'
  ) THEN
    CREATE POLICY "operations_asset_movements manage access" 
    ON public.operations_asset_movements FOR ALL 
    USING (
      ((SELECT (privileges->'opsInventory'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) 
      OR public.is_admin()
    );
  END IF;
END $$;
