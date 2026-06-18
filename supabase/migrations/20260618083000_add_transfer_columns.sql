-- Add transfer columns to operations_waybills
ALTER TABLE public.operations_waybills ADD COLUMN IF NOT EXISTS transfer_site_name TEXT;
ALTER TABLE public.operations_waybills ADD COLUMN IF NOT EXISTS transfer_site_id TEXT;
