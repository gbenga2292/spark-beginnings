-- Migration: Add invoice linkage and multi-invoice allocations to payments
-- Timestamp: 2026-09-14 14:00:00

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allocations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unapplied_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.payments.invoice_id IS 'Target primary invoice ID linked to this payment';
COMMENT ON COLUMN public.payments.invoice_number IS 'Target primary invoice number (e.g. INV-0012)';
COMMENT ON COLUMN public.payments.allocations IS 'Array of allocations across multiple invoices: [{ invoiceId, invoiceNumber, amount, withholdingTax, discount }]';
COMMENT ON COLUMN public.payments.unapplied_amount IS 'Surplus / advance credit unapplied to any invoice';
