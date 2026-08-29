-- Add replaced_asset_id and swap_reason to operations_site_pump_dates
ALTER TABLE public.operations_site_pump_dates 
ADD COLUMN IF NOT EXISTS replaced_asset_id TEXT,
ADD COLUMN IF NOT EXISTS swap_reason TEXT;
