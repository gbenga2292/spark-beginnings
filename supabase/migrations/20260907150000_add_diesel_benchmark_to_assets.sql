-- Migration: Add Diesel Fuel Telemetry Benchmark fields to operations_assets
-- Adds tank_capacity_litres and expected_daily_burn_rate for equipment assets

ALTER TABLE public.operations_assets 
  ADD COLUMN IF NOT EXISTS tank_capacity_litres NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_daily_burn_rate NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.operations_assets.tank_capacity_litres IS 'Fuel tank capacity in Litres for diesel equipment';
COMMENT ON COLUMN public.operations_assets.expected_daily_burn_rate IS 'Rated diesel fuel consumption in Litres per 24h operational day';
