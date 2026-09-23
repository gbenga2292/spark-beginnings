-- Add document_url and document_name to vendor_invoices for attachment support
ALTER TABLE vendor_invoices 
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS document_name TEXT;
