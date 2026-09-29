-- Add internal_notes, show_notes_as_line_items, and note_line_items to invoices and pending_invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS show_notes_as_line_items BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS note_line_items JSONB DEFAULT '[]'::jsonb;

ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS show_notes_as_line_items BOOLEAN DEFAULT false;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS note_line_items JSONB DEFAULT '[]'::jsonb;
