-- Migration: Add linked_ledger_ids column to vehicle_fuel_logs
-- Purpose: Store linked ledger entry IDs (with optional serialized amounts) for vehicle fuel logs

ALTER TABLE vehicle_fuel_logs ADD COLUMN IF NOT EXISTS linked_ledger_ids text[] DEFAULT '{}'::text[];
