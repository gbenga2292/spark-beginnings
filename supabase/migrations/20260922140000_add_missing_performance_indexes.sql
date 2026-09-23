-- ─── Missing Performance Indexes ──────────────────────────────────────────────
-- Covers: comm_logs, invoices, payments, vat_payments, leaves, salary_advances,
--         loans, disciplinary_records, evaluations, company_expenses,
--         vehicle_movement_log, staff_merit_record,
--         main_tasks, subtasks, task_updates, task_participant_status,
--         task_update_receipts, reminders

-- ── 1. comm_logs ──────────────────────────────────────────────────────────────
-- ORDER BY date DESC on every app load + follow-up filtering in System Alerts
CREATE INDEX IF NOT EXISTS idx_comm_logs_date
  ON public.comm_logs (date DESC);

CREATE INDEX IF NOT EXISTS idx_comm_logs_client
  ON public.comm_logs (client);

CREATE INDEX IF NOT EXISTS idx_comm_logs_follow_up_date
  ON public.comm_logs (follow_up_date)
  WHERE follow_up_date IS NOT NULL AND follow_up_done = false;

-- ── 2. invoices ───────────────────────────────────────────────────────────────
-- ORDER BY date DESC on load; filtered by client/status/site in useActiveSiteInvoices
CREATE INDEX IF NOT EXISTS idx_invoices_date
  ON public.invoices (date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_client
  ON public.invoices (client);

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON public.invoices (status);

CREATE INDEX IF NOT EXISTS idx_invoices_site_id
  ON public.invoices (site_id);

-- Composite used by useActiveSiteInvoices: filter active invoices by client+site
CREATE INDEX IF NOT EXISTS idx_invoices_client_status
  ON public.invoices (client, status);

-- ── 3. payments ───────────────────────────────────────────────────────────────
-- ORDER BY date DESC; filtered by client for payment reconciliation
CREATE INDEX IF NOT EXISTS idx_payments_date
  ON public.payments (date DESC);

CREATE INDEX IF NOT EXISTS idx_payments_client
  ON public.payments (client);

-- ── 4. vat_payments ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vat_payments_date
  ON public.vat_payments (date DESC);

CREATE INDEX IF NOT EXISTS idx_vat_payments_client
  ON public.vat_payments (client);

-- ── 5. leaves ─────────────────────────────────────────────────────────────────
-- FK employee_id unindexed; ORDER BY start_date DESC; filtered by status
CREATE INDEX IF NOT EXISTS idx_leaves_employee_id
  ON public.leaves (employee_id);

CREATE INDEX IF NOT EXISTS idx_leaves_status
  ON public.leaves (status);

CREATE INDEX IF NOT EXISTS idx_leaves_start_date
  ON public.leaves (start_date DESC);

-- ── 6. salary_advances ────────────────────────────────────────────────────────
-- FK employee_id unindexed; payroll calculator filters per employee
CREATE INDEX IF NOT EXISTS idx_salary_advances_employee_id
  ON public.salary_advances (employee_id);

CREATE INDEX IF NOT EXISTS idx_salary_advances_status
  ON public.salary_advances (status);

-- ── 7. loans ──────────────────────────────────────────────────────────────────
-- Same pattern as salary_advances
CREATE INDEX IF NOT EXISTS idx_loans_employee_id
  ON public.loans (employee_id);

CREATE INDEX IF NOT EXISTS idx_loans_status
  ON public.loans (status);

-- ── 8. disciplinary_records ───────────────────────────────────────────────────
-- ORDER BY date DESC; HR dashboard filters per employee
CREATE INDEX IF NOT EXISTS idx_disciplinary_records_employee_id
  ON public.disciplinary_records (employee_id);

CREATE INDEX IF NOT EXISTS idx_disciplinary_records_date
  ON public.disciplinary_records (date DESC);

-- ── 9. evaluations ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_evaluations_employee_id
  ON public.evaluations (employee_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_date
  ON public.evaluations (date DESC);

-- ── 10. company_expenses ──────────────────────────────────────────────────────
-- ORDER BY date DESC; ledger filters by status
CREATE INDEX IF NOT EXISTS idx_company_expenses_date
  ON public.company_expenses (date DESC);

CREATE INDEX IF NOT EXISTS idx_company_expenses_status
  ON public.company_expenses (status)
  WHERE status IS NOT NULL;

-- ── 11. vehicle_movement_log ──────────────────────────────────────────────────
-- ORDER BY departure_time DESC; fleet view filters per vehicle
CREATE INDEX IF NOT EXISTS idx_vehicle_movement_log_vehicle_id
  ON public.vehicle_movement_log (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_movement_log_departure
  ON public.vehicle_movement_log (departure_time DESC);

-- ── 12. staff_merit_record ────────────────────────────────────────────────────
-- Filtered by employee_id when viewing staff profile
CREATE INDEX IF NOT EXISTS idx_staff_merit_record_employee_id
  ON public.staff_merit_record (employee_id);

-- ── 13. main_tasks ────────────────────────────────────────────────────────────
-- Queried with .eq('is_deleted', false) — partial index is perfect here
-- Also searched by workspaceId, assignedTo, deadline for task board filtering
CREATE INDEX IF NOT EXISTS idx_main_tasks_is_deleted
  ON public.main_tasks (is_deleted)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_main_tasks_workspace
  ON public.main_tasks ("workspaceId");

CREATE INDEX IF NOT EXISTS idx_main_tasks_assigned_to
  ON public.main_tasks (assigned_to);

CREATE INDEX IF NOT EXISTS idx_main_tasks_deadline
  ON public.main_tasks (deadline)
  WHERE deadline IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_main_tasks_title
  ON public.main_tasks (title)
  WHERE is_deleted = false;

-- ── 14. subtasks ──────────────────────────────────────────────────────────────
-- Queried with .eq('is_deleted', false); joined to main_task_id for task board
CREATE INDEX IF NOT EXISTS idx_subtasks_is_deleted
  ON public.subtasks (is_deleted)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_subtasks_main_task_id
  ON public.subtasks (main_task_id);

CREATE INDEX IF NOT EXISTS idx_subtasks_assigned_to
  ON public.subtasks (assigned_to);

CREATE INDEX IF NOT EXISTS idx_subtasks_status
  ON public.subtasks (status);

-- ── 15. task_updates ──────────────────────────────────────────────────────────
-- ORDER BY created_at DESC; filtered by task_id for chat view
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id
  ON public.task_updates (task_id);

CREATE INDEX IF NOT EXISTS idx_task_updates_main_task_id
  ON public.task_updates (main_task_id);

CREATE INDEX IF NOT EXISTS idx_task_updates_created_at
  ON public.task_updates (created_at DESC);

-- ── 16. task_participant_status ───────────────────────────────────────────────
-- Realtime table; looked up by task_id + user_id (already UNIQUE but no index)
CREATE INDEX IF NOT EXISTS idx_task_participant_status_task_id
  ON public.task_participant_status (task_id);

CREATE INDEX IF NOT EXISTS idx_task_participant_status_user_id
  ON public.task_participant_status (user_id);

-- ── 17. task_update_receipts ──────────────────────────────────────────────────
-- Looked up by update_id per message receipt check
CREATE INDEX IF NOT EXISTS idx_task_update_receipts_user_id
  ON public.task_update_receipts (user_id);

-- ── 18. reminders ─────────────────────────────────────────────────────────────
-- Filtered by is_active + next_remind_at in System Alerts
CREATE INDEX IF NOT EXISTS idx_reminders_is_active
  ON public.reminders (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_reminders_next_remind_at
  ON public.reminders (next_remind_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_reminders_main_task_id
  ON public.reminders (main_task_id)
  WHERE main_task_id IS NOT NULL;
