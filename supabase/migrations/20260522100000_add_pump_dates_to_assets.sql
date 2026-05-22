ALTER TABLE public.operations_assets ADD COLUMN IF NOT EXISTS pump_start_date DATE;
ALTER TABLE public.operations_assets ADD COLUMN IF NOT EXISTS pump_stop_date DATE;
