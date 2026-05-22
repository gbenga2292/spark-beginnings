ALTER TABLE public.invoices ADD COLUMN count_off_days BOOLEAN DEFAULT true;
ALTER TABLE public.pending_invoices ADD COLUMN count_off_days BOOLEAN DEFAULT true;
