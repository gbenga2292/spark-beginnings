-- Add pump_start_date to invoices and pending_invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pump_start_date TEXT;
ALTER TABLE public.pending_invoices ADD COLUMN IF NOT EXISTS pump_start_date TEXT;

