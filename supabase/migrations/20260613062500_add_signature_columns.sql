-- Add signature column to profiles and operations_waybills tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE public.operations_waybills ADD COLUMN IF NOT EXISTS signature TEXT;
