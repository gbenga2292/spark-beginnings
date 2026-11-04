-- Add multiple emails, phones, and bank accounts to ledger_vendors
ALTER TABLE public.ledger_vendors
  ADD COLUMN IF NOT EXISTS emails JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_accounts JSONB DEFAULT '[]'::jsonb;

