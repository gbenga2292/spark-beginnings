-- Add missing arrows and texts columns to dewatering_layouts table
ALTER TABLE public.dewatering_layouts
ADD COLUMN IF NOT EXISTS arrows jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS texts jsonb DEFAULT '[]'::jsonb;
