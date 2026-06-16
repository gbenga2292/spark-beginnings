-- Migration: Create vehicle_fuel_logs table
-- Date: 2026-06-16
-- Purpose: Track fuel purchases per vehicle with bidirectional price/litre computation

CREATE TABLE IF NOT EXISTS vehicle_fuel_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      TEXT NOT NULL,
  vehicle_reg     TEXT NOT NULL,
  date            DATE NOT NULL,
  rate_per_litre  NUMERIC(12, 2) NOT NULL,  -- ₦ per litre
  litres          NUMERIC(12, 4) NOT NULL,
  total_cost      NUMERIC(14, 2) NOT NULL,
  odometer        NUMERIC(12, 1),
  filled_by       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast filtering by year/month
CREATE INDEX IF NOT EXISTS idx_vehicle_fuel_logs_date ON vehicle_fuel_logs (date DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_fuel_logs_vehicle ON vehicle_fuel_logs (vehicle_id);

-- Enable Row Level Security (consistent with existing tables)
ALTER TABLE vehicle_fuel_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (same pattern as other operations tables)
CREATE POLICY "Authenticated users can manage fuel logs"
  ON vehicle_fuel_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_fuel_logs;
