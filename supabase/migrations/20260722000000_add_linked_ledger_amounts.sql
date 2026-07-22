-- Migration: Add linked_ledger_amounts column to vehicle_fuel_logs
-- Purpose: Store optional JSON map of custom allocated amounts per linked ledger entry

ALTER TABLE vehicle_fuel_logs ADD COLUMN IF NOT EXISTS linked_ledger_amounts JSONB DEFAULT '{}'::jsonb;
