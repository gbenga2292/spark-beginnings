-- ─── Ledger & Vendor Performance Indexes ──────────────────────────────────────
-- Optimizes auto-matching, live searching, and verification across 10,000+ records

-- 1. Ledger Entries Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_entries_voucher_no 
  ON public.ledger_entries (voucher_no);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_date 
  ON public.ledger_entries (date DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_amount 
  ON public.ledger_entries (amount);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_vendor 
  ON public.ledger_entries (vendor);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_bank 
  ON public.ledger_entries (bank);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_match_lookup 
  ON public.ledger_entries (amount, date, vendor, bank);

-- 2. Vendor Invoice Payments Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_invoice_payments_ledger_entry_id 
  ON public.vendor_invoice_payments (ledger_entry_id) 
  WHERE ledger_entry_id IS NOT NULL;

-- 3. Vendor Invoices Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_invoice_number 
  ON public.vendor_invoices (invoice_number);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_vendor_id 
  ON public.vendor_invoices (vendor_id) 
  WHERE vendor_id IS NOT NULL;
