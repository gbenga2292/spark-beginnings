-- Add auxiliary equipment and auxiliary cost to invoices and pending_invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS auxiliary_equipment JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS auxiliary_cost NUMERIC DEFAULT 0;

ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS auxiliary_equipment JSONB DEFAULT '[]'::jsonb;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS auxiliary_cost NUMERIC DEFAULT 0;
