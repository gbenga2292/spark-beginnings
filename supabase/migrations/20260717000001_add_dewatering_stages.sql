-- Migration: Add Dewatering Stage Tracking
-- Adds operational stage columns to both the sites table and site_journal_entries
-- so supervisors can log and track where each site is in the dewatering lifecycle.
-- Stages: mobilization → installation → operation → demobilisation

-- 1. Add current_dewatering_stage to the sites table
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS current_dewatering_stage TEXT DEFAULT 'mobilization'
    CHECK (current_dewatering_stage IN ('mobilization', 'installation', 'operation', 'demobilisation'));

-- 2. Add dewatering_stage to site_journal_entries so each log record captures
--    what stage the site was in on that day
ALTER TABLE public.site_journal_entries
  ADD COLUMN IF NOT EXISTS dewatering_stage TEXT
    CHECK (dewatering_stage IN ('mobilization', 'installation', 'operation', 'demobilisation'));
