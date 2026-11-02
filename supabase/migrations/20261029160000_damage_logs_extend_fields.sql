-- Migration: Extend damage_logs with new columns and update location/fault types
-- Adds: quantity_damaged, cause_notes
-- Updates: location_type and fault_attribution value comments

ALTER TABLE public.damage_logs
  ADD COLUMN IF NOT EXISTS quantity_damaged INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cause_notes TEXT;

-- Update the column comments to document the revised enum values
COMMENT ON COLUMN public.damage_logs.location_type IS
  'active_site | old_site | office | warehouse | transit | other';

COMMENT ON COLUMN public.damage_logs.fault_attribution IS
  'client | dcel_personnel | act_of_god';
