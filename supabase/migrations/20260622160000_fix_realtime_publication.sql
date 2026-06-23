-- ============================================================
-- Fix Realtime Publication
--
-- Root cause of realtime lag: most tables were never added
-- to the supabase_realtime publication so Postgres change
-- events were never broadcast to clients.
--
-- This migration:
--   1. Adds every core table to the supabase_realtime publication
--   2. Sets REPLICA IDENTITY FULL on tables where old-row data
--      is required (profiles, employees, etc.) so DELETE and
--      UPDATE payloads include the previous values the client
--      needs to detect changes (e.g. privilege diffs).
-- ============================================================

-- ── REPLICA IDENTITY FULL ─────────────────────────────────────────────────
-- Required for: correct OLD row in UPDATE/DELETE realtime payloads.
-- Without this, payload.old is empty {} and privilege-change detection
-- in useDataLoader.ts silently fails.
ALTER TABLE public.profiles              REPLICA IDENTITY FULL;
ALTER TABLE public.employees             REPLICA IDENTITY FULL;
ALTER TABLE public.sites                 REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_records    REPLICA IDENTITY FULL;
ALTER TABLE public.invoices              REPLICA IDENTITY FULL;
ALTER TABLE public.pending_invoices      REPLICA IDENTITY FULL;
ALTER TABLE public.salary_advances       REPLICA IDENTITY FULL;
ALTER TABLE public.loans                 REPLICA IDENTITY FULL;
ALTER TABLE public.payments              REPLICA IDENTITY FULL;
ALTER TABLE public.vat_payments          REPLICA IDENTITY FULL;
ALTER TABLE public.leaves                REPLICA IDENTITY FULL;
ALTER TABLE public.leave_types           REPLICA IDENTITY FULL;
ALTER TABLE public.disciplinary_records  REPLICA IDENTITY FULL;
ALTER TABLE public.evaluations           REPLICA IDENTITY FULL;
ALTER TABLE public.comm_logs             REPLICA IDENTITY FULL;
ALTER TABLE public.company_expenses      REPLICA IDENTITY FULL;
ALTER TABLE public.pending_sites         REPLICA IDENTITY FULL;
ALTER TABLE public.clients               REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_entries        REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_categories     REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_vendors        REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_banks          REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_beneficiary_banks REPLICA IDENTITY FULL;
ALTER TABLE public.daily_journals        REPLICA IDENTITY FULL;
ALTER TABLE public.site_journal_entries  REPLICA IDENTITY FULL;
ALTER TABLE public.vehicles              REPLICA IDENTITY FULL;
ALTER TABLE public.vehicle_movement_log  REPLICA IDENTITY FULL;
ALTER TABLE public.vehicle_document_types REPLICA IDENTITY FULL;
ALTER TABLE public.interview_candidates  REPLICA IDENTITY FULL;
ALTER TABLE public.positions             REPLICA IDENTITY FULL;
ALTER TABLE public.departments           REPLICA IDENTITY FULL;
ALTER TABLE public.public_holidays       REPLICA IDENTITY FULL;
ALTER TABLE public.department_tasks      REPLICA IDENTITY FULL;
ALTER TABLE public.staff_merit_record    REPLICA IDENTITY FULL;
ALTER TABLE public.privilege_presets     REPLICA IDENTITY FULL;
ALTER TABLE public.app_settings          REPLICA IDENTITY FULL;
ALTER TABLE public.client_contacts       REPLICA IDENTITY FULL;
ALTER TABLE public.main_tasks            REPLICA IDENTITY FULL;
ALTER TABLE public.subtasks              REPLICA IDENTITY FULL;
ALTER TABLE public.task_updates          REPLICA IDENTITY FULL;
ALTER TABLE public.reminders             REPLICA IDENTITY FULL;
ALTER TABLE public.operations_assets     REPLICA IDENTITY FULL;
ALTER TABLE public.operations_waybills   REPLICA IDENTITY FULL;
ALTER TABLE public.operations_checkouts  REPLICA IDENTITY FULL;
ALTER TABLE public.operations_maintenance REPLICA IDENTITY FULL;
ALTER TABLE public.operations_daily_logs REPLICA IDENTITY FULL;
ALTER TABLE public.operations_site_pump_dates REPLICA IDENTITY FULL;
ALTER TABLE public.maintenance_certificates REPLICA IDENTITY FULL;
ALTER TABLE public.vehicle_fuel_logs     REPLICA IDENTITY FULL;
ALTER TABLE public.diesel_refills        REPLICA IDENTITY FULL;

-- ── ADD TABLES TO REALTIME PUBLICATION ───────────────────────────────────
-- Each table must be explicitly added for Supabase to broadcast changes.
-- Using DO block with IF NOT EXISTS logic to be idempotent.

DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'profiles', 'employees', 'sites', 'attendance_records',
    'invoices', 'pending_invoices', 'salary_advances', 'loans',
    'payments', 'vat_payments', 'leaves', 'leave_types',
    'disciplinary_records', 'evaluations', 'comm_logs', 'company_expenses',
    'pending_sites', 'clients', 'ledger_entries', 'ledger_categories',
    'ledger_vendors', 'ledger_banks', 'ledger_beneficiary_banks',
    'daily_journals', 'site_journal_entries', 'vehicles', 'vehicle_movement_log',
    'vehicle_document_types', 'interview_candidates', 'positions', 'departments',
    'public_holidays', 'department_tasks', 'staff_merit_record',
    'privilege_presets', 'app_settings', 'client_contacts',
    'main_tasks', 'subtasks', 'task_updates', 'reminders',
    'operations_assets', 'operations_waybills', 'operations_checkouts',
    'operations_maintenance', 'operations_daily_logs', 'operations_site_pump_dates',
    'maintenance_certificates', 'vehicle_fuel_logs', 'diesel_refills'
  ];
  tbl TEXT;
  already_in BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    -- Check if table is already in the publication to keep this idempotent
    SELECT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) INTO already_in;

    IF NOT already_in THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE 'Added % to supabase_realtime publication', tbl;
    ELSE
      RAISE NOTICE '% already in supabase_realtime publication, skipping', tbl;
    END IF;
  END LOOP;
END $$;
