-- Migration: Add dipstick level and is_tank_filled_to_full to operations_daily_logs
-- Enables accurate ground-truth fuel level tracking and avoids assuming full refills

ALTER TABLE public.operations_daily_logs 
  ADD COLUMN IF NOT EXISTS dipstick_level_litres NUMERIC,
  ADD COLUMN IF NOT EXISTS is_tank_filled_to_full BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.operations_daily_logs.dipstick_level_litres IS 'Physical fuel level measured by dipstick at end of shift in Litres';
COMMENT ON COLUMN public.operations_daily_logs.is_tank_filled_to_full IS 'True if the diesel refill topped the machine tank to 100% full';
