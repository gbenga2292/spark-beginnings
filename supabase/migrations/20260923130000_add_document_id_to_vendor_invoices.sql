-- Add document_id to vendor_invoices to allow deleting from media server
ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS document_id TEXT;
