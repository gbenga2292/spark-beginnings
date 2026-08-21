-- Add Expenses VAT columns to ledger_entries
ALTER TABLE public.ledger_entries
ADD COLUMN IF NOT EXISTS is_vatable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_mode TEXT DEFAULT 'No',
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 7.5,
ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_for_vat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_amount NUMERIC DEFAULT 0;

-- Add expense_vat_remittances to app_settings
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS expense_vat_remittances JSONB DEFAULT '[]'::jsonb;
