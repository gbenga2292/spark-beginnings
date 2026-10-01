-- Add Withholding Tax (WHT) fields to invoices and pending_invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wht_rate NUMERIC;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wht_amount NUMERIC;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wht_timing TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wht_deduction_type TEXT;

ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS wht_rate NUMERIC;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS wht_amount NUMERIC;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS wht_timing TEXT;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS wht_deduction_type TEXT;
