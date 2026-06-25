ALTER TABLE public.operations_assets 
ADD COLUMN IF NOT EXISTS restock_history JSONB NOT NULL DEFAULT '[]'::jsonb;
