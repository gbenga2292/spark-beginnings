-- =============================================================================
-- MIGRATION: Merge "Ototo Community 2" into "Ototo Community Abeokuta"
-- =============================================================================
-- Date       : 2026-09-23
-- Reason     : "Ototo Community 2" was erroneously created as a new site when
--              the original site (Ototo Community Abeokuta) was restarted after
--              demobilisation. This migration consolidates all records under the
--              canonical site and removes the duplicate.
--
-- KEEP   -> Ototo Community Abeokuta  | ID: eb2508fb-7941-40ff-ad0b-dc3b64258a79
-- DELETE -> Ototo Community 2         | ID: 855d6600-49f3-4288-a885-fc40551b4235
--
-- Additional fixes:
--   - WB-136 waybill had a phantom site_id (1eac5c69-...) that never existed
--     in the sites table. Corrected to the canonical Abeokuta ID.
--   - 2 comm_logs under "Ototo Community Kobape Rd, Abeokuta" merged in.
--   - UNIQUE(asset_id, site_id) constraint on operations_site_pump_dates dropped
--     as it incorrectly prevented the same pump deploying to the same site
--     across multiple phases (Phase 1 ended Aug 2026, Phase 2/restart Sep 2026).
--
-- ALREADY APPLIED: 2026-09-23 via Supabase MCP execute_sql
-- =============================================================================

BEGIN;

-- STEP 1: Reactivate Ototo Community Abeokuta (was marked Ended)
UPDATE public.sites
SET status = 'Active'
WHERE id = 'eb2508fb-7941-40ff-ad0b-dc3b64258a79'
  AND status = 'Ended';

-- STEP 2: Re-point attendance_records (TEXT name fields)
UPDATE public.attendance_records
SET day_site = 'Ototo Community Abeokuta'
WHERE day_site = 'Ototo Community 2';

UPDATE public.attendance_records
SET day_site = 'Ototo Community Abeokuta'
WHERE day_site ILIKE '%ototo%kobape%';

UPDATE public.attendance_records
SET night_site = 'Ototo Community Abeokuta'
WHERE night_site = 'Ototo Community 2'
   OR night_site ILIKE '%ototo%kobape%';

-- STEP 3: Re-point operations_daily_logs
UPDATE public.operations_daily_logs
SET
  site_id   = 'eb2508fb-7941-40ff-ad0b-dc3b64258a79',
  site_name = 'Ototo Community Abeokuta'
WHERE site_id = '855d6600-49f3-4288-a885-fc40551b4235';

-- STEP 4: Re-point site_journal_entries + add lightweight restart audit note
UPDATE public.site_journal_entries
SET
  site_id   = 'eb2508fb-7941-40ff-ad0b-dc3b64258a79',
  site_name = 'Ototo Community Abeokuta',
  narration = '[Restart phase - originally logged under Ototo Community 2] ' || COALESCE(narration, '')
WHERE site_id = '855d6600-49f3-4288-a885-fc40551b4235';

-- STEP 5: Re-point invoices (treated as continuation, no invoice annotation)
UPDATE public.invoices
SET
  site_id   = 'eb2508fb-7941-40ff-ad0b-dc3b64258a79',
  site_name = 'Ototo Community Abeokuta'
WHERE site_name = 'Ototo Community 2';

-- STEP 6: Re-point comm_logs (3 name variants unified)
UPDATE public.comm_logs
SET
  site_id   = 'eb2508fb-7941-40ff-ad0b-dc3b64258a79',
  site_name = 'Ototo Community Abeokuta'
WHERE site_name IN ('Ototo Community 2', 'Ototo Community Kobape Rd, Abeokuta')
   OR site_id = '855d6600-49f3-4288-a885-fc40551b4235';

-- STEP 7: Drop overly-restrictive unique constraint on pump_dates
-- UNIQUE(asset_id, site_id) prevented valid multi-phase deployments of the same pump.
ALTER TABLE public.operations_site_pump_dates DROP CONSTRAINT IF EXISTS unique_asset_site;

-- STEP 8: Re-point pump date restart record (Pump 403, Phase 2, still running)
UPDATE public.operations_site_pump_dates
SET site_id = 'eb2508fb-7941-40ff-ad0b-dc3b64258a79'
WHERE site_id = '855d6600-49f3-4288-a885-fc40551b4235';

-- STEP 9: Fix WB-136 phantom site_id
UPDATE public.operations_waybills
SET
  site_id   = 'eb2508fb-7941-40ff-ad0b-dc3b64258a79',
  site_name = 'Ototo Community Abeokuta'
WHERE id = 'WB-136'
  AND site_name = 'Ototo Community 2';

-- STEP 10: Delete the erroneous duplicate site
DELETE FROM public.sites
WHERE id   = '855d6600-49f3-4288-a885-fc40551b4235'
  AND name = 'Ototo Community 2';


-- STEP 11 (Added post-discovery): Re-point operations_asset_movements (312 records)
-- This table was missed in the initial sweep (discovered via full schema audit).
UPDATE public.operations_asset_movements
SET
  site_id   = 'eb2508fb-7941-40ff-ad0b-dc3b64258a79',
  site_name = 'Ototo Community Abeokuta'
WHERE site_name = 'Ototo Community 2'
   OR site_id   = '855d6600-49f3-4288-a885-fc40551b4235';

COMMIT;

