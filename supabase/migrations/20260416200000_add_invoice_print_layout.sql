ALTER TABLE invoices ADD COLUMN print_layout JSONB DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN history_log JSONB DEFAULT '[]'::jsonb;

ALTER TABLE pending_invoices ADD COLUMN print_layout JSONB DEFAULT NULL;
ALTER TABLE pending_invoices ADD COLUMN history_log JSONB DEFAULT '[]'::jsonb;
