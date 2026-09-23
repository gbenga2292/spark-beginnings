-- Add extended profile fields to ledger_vendors
ALTER TABLE ledger_vendors
  ADD COLUMN IF NOT EXISTS address     TEXT,
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_name   TEXT,
  ADD COLUMN IF NOT EXISTS notes       TEXT;
