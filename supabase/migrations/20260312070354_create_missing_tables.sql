-- Reconstructed schema for missing tables from TypeScript definitions

CREATE TABLE IF NOT EXISTS public.activities (
  action TEXT NOT NULL,
  created_at TEXT DEFAULT now(),
  details TEXT,
  entity TEXT NOT NULL,
  entity_id TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TEXT NOT NULL,
  updated_at TEXT DEFAULT now(),
  user_id TEXT,
  user_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.assets (
  available_quantity NUMERIC,
  category TEXT,
  condition TEXT,
  cost NUMERIC,
  created_at TEXT DEFAULT now(),
  critical_stock_level NUMERIC,
  damaged_count NUMERIC,
  deployment_date TEXT,
  description TEXT,
  electricity_consumption NUMERIC,
  fuel_capacity NUMERIC,
  fuel_consumption_rate NUMERIC,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT,
  low_stock_level NUMERIC,
  missing_count NUMERIC,
  model TEXT,
  name TEXT NOT NULL,
  power_source TEXT,
  purchase_date TEXT,
  quantity NUMERIC NOT NULL,
  requires_logging BOOLEAN,
  reserved_quantity NUMERIC,
  serial_number TEXT,
  service TEXT,
  service_interval NUMERIC,
  site_id TEXT,
  site_quantities TEXT,
  status TEXT,
  type TEXT,
  unit_of_measurement TEXT NOT NULL,
  updated_at TEXT DEFAULT now(),
  used_count NUMERIC
);

CREATE TABLE IF NOT EXISTS public.comm_logs (
  channel TEXT NOT NULL,
  client TEXT,
  contact_person TEXT,
  contact_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT now(),
  date TEXT NOT NULL,
  direction TEXT NOT NULL,
  follow_up_date TEXT,
  follow_up_done BOOLEAN NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_by TEXT NOT NULL,
  notes TEXT NOT NULL,
  outcome TEXT,
  site_id TEXT,
  site_name TEXT,
  subject TEXT,
  time TEXT,
  updated_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_expenses (
  amount NUMERIC NOT NULL,
  created_at TEXT DEFAULT now(),
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  entered_by TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_from TEXT NOT NULL,
  paid_to_account_no TEXT NOT NULL,
  paid_to_bank_name TEXT NOT NULL,
  status TEXT
);

CREATE TABLE IF NOT EXISTS public.consumable_logs (
  consumable_id TEXT NOT NULL,
  consumable_name TEXT NOT NULL,
  created_at TEXT DEFAULT now(),
  date TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  quantity_remaining NUMERIC NOT NULL,
  quantity_used NUMERIC NOT NULL,
  site_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  updated_at TEXT DEFAULT now(),
  used_by TEXT NOT NULL,
  used_for TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.disciplinary_records (
  acknowledged BOOLEAN,
  action_taken TEXT,
  attachments JSONB,
  committee_meeting_date TEXT,
  created_at TEXT DEFAULT now(),
  created_by TEXT,
  date TEXT NOT NULL,
  description TEXT,
  employee_comment TEXT,
  employee_id TEXT,
  final_result TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initial_result TEXT,
  points NUMERIC,
  query_deadline TEXT,
  query_issued BOOLEAN,
  query_replied BOOLEAN,
  query_reply_text TEXT,
  reported_by TEXT,
  severity TEXT NOT NULL,
  status TEXT,
  suspension_end_date TEXT,
  suspension_start_date TEXT,
  type TEXT NOT NULL,
  updated_at TEXT DEFAULT now(),
  visible_to_employee BOOLEAN,
  workflow_state TEXT
);

CREATE TABLE IF NOT EXISTS public.equipment_logs (
  active BOOLEAN,
  client_feedback TEXT,
  created_at TEXT DEFAULT now(),
  date TEXT NOT NULL,
  diesel_entered NUMERIC,
  downtime_entries JSONB,
  equipment_id TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issues_on_site TEXT,
  maintenance_details TEXT,
  site_id TEXT NOT NULL,
  supervisor_on_site TEXT,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evaluations (
  acknowledged BOOLEAN,
  created_at TEXT DEFAULT now(),
  created_by TEXT,
  date TEXT NOT NULL,
  employee_comment TEXT,
  employee_id TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_notes TEXT,
  overall_score NUMERIC,
  scores JSONB,
  status TEXT,
  type TEXT NOT NULL,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_log (
  corrective_action TEXT,
  created_at TEXT DEFAULT now(),
  description TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_date TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  persons_involved TEXT,
  reported_by_id TEXT,
  reported_by_name TEXT,
  site_id TEXT,
  site_name TEXT,
  status TEXT,
  vehicle_id TEXT,
  workspace_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ledger_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ledger_beneficiary_banks (
  account_no TEXT NOT NULL,
  created_at TEXT DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ledger_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  amount NUMERIC NOT NULL,
  bank TEXT,
  category TEXT NOT NULL,
  client TEXT,
  created_at TEXT DEFAULT now(),
  date TEXT NOT NULL,
  description TEXT,
  entered_by TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site TEXT,
  updated_at TEXT DEFAULT now(),
  vendor TEXT,
  voucher_no TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ledger_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tin_number TEXT
);

CREATE TABLE IF NOT EXISTS public.main_tasks (
  assigned_to TEXT,
  assignedTo TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT now(),
  created_by TEXT,
  createdBy TEXT,
  deadline TEXT,
  description TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_deleted BOOLEAN,
  deleted_at TEXT,
  is_project BOOLEAN,
  priority TEXT,
  teamId TEXT,
  title TEXT,
  updated_at TEXT DEFAULT now(),
  workspaceId TEXT
);

CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  asset_id TEXT,
  cost NUMERIC,
  created_at TEXT DEFAULT now(),
  description TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_hours NUMERIC,
  maintenance_type TEXT NOT NULL,
  next_service_date TEXT,
  performed_by TEXT,
  service_date TEXT NOT NULL,
  status TEXT,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.metrics_snapshots (
  created_at TEXT DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  low_stock NUMERIC,
  out_of_stock NUMERIC,
  outstanding_checkouts NUMERIC,
  outstanding_waybills NUMERIC,
  snapshot_date TEXT NOT NULL,
  total_assets NUMERIC,
  total_quantity NUMERIC,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.op_company_settings (
  address TEXT NOT NULL,
  ai_config TEXT,
  company_name TEXT NOT NULL,
  created_at TEXT DEFAULT now(),
  currency TEXT,
  date_format TEXT,
  email TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo TEXT,
  notifications_email BOOLEAN,
  notifications_push BOOLEAN,
  phone TEXT NOT NULL,
  theme TEXT,
  updated_at TEXT DEFAULT now(),
  website TEXT
);

CREATE TABLE IF NOT EXISTS public.pending_sites (
  client_name TEXT NOT NULL,
  created_at TEXT DEFAULT now(),
  data JSONB NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permit_to_work (
  created_at TEXT DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issued_at TEXT,
  issued_by_id TEXT,
  issued_by_name TEXT,
  notes TEXT,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  start_date TEXT,
  status TEXT,
  workspace_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_lifecycle_task (
  assigned_to_id TEXT,
  assigned_to_name TEXT,
  completed_at TEXT,
  completed_by_id TEXT,
  completed_by_name TEXT,
  created_at TEXT DEFAULT now(),
  deadline TEXT NOT NULL,
  description TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  justification TEXT,
  linked_main_task_id TEXT,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  soil_test_findings TEXT,
  status TEXT,
  task_code TEXT NOT NULL,
  title TEXT NOT NULL,
  workspace_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quick_checkouts (
  asset_id TEXT NOT NULL,
  checkout_date TEXT NOT NULL,
  created_at TEXT DEFAULT now(),
  employee_id TEXT,
  expected_return_days NUMERIC NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  quantity NUMERIC NOT NULL,
  returned_quantity NUMERIC,
  status TEXT,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminders (
  body TEXT,
  created_at TEXT DEFAULT now(),
  created_by TEXT,
  end_at TEXT,
  frequency TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN,
  last_sent_at TEXT,
  main_task_id TEXT,
  next_remind_at TEXT,
  recipient_ids TEXT,
  remind_at TEXT NOT NULL,
  send_email BOOLEAN,
  snoozed_until TEXT,
  source_ref TEXT,
  subtask_id TEXT,
  title TEXT NOT NULL,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.return_bills (
  condition TEXT,
  created_at TEXT DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  received_by TEXT NOT NULL,
  return_date TEXT NOT NULL,
  status TEXT,
  updated_at TEXT DEFAULT now(),
  waybill_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.return_items (
  asset_id TEXT NOT NULL,
  condition TEXT,
  created_at TEXT DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity NUMERIC NOT NULL,
  return_bill_id TEXT NOT NULL,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_transactions (
  asset_id TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  condition TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  created_by TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  quantity NUMERIC NOT NULL,
  reference_id TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  site_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.staff_merit_record (
  category TEXT NOT NULL,
  created_at TEXT DEFAULT now(),
  description TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  hr_notified BOOLEAN,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_date TEXT NOT NULL,
  logged_by_id TEXT,
  logged_by_name TEXT,
  record_type TEXT NOT NULL,
  site_id TEXT,
  site_name TEXT,
  workspace_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.subtasks (
  approvedBy TEXT,
  assigned_to TEXT,
  assignedTo TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT now(),
  deadline TEXT,
  description TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_deleted BOOLEAN,
  deleted_at TEXT,
  main_task_id TEXT,
  mainTaskId TEXT,
  pendingApprovalSince TEXT,
  priority TEXT,
  rejectedAt TEXT,
  status TEXT,
  title TEXT,
  updated_at TEXT DEFAULT now(),
  workspaceId TEXT
);

CREATE TABLE IF NOT EXISTS public.task_updates (
  attachments JSONB,
  author_id TEXT,
  created_at TEXT DEFAULT now(),
  file_links JSONB,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_task_id TEXT,
  subtask_id TEXT,
  task_id TEXT,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tasks (
  assignee_id TEXT,
  created_at TEXT DEFAULT now(),
  created_by TEXT,
  department TEXT,
  description TEXT,
  due_date TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT,
  site_id TEXT,
  status TEXT,
  title TEXT NOT NULL,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_movement_log (
  arrival_time TEXT,
  created_at TEXT DEFAULT now(),
  created_by_id TEXT,
  created_by_name TEXT,
  departure_time TEXT NOT NULL,
  driver_employee_id TEXT,
  driver_name TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  odometer_end NUMERIC,
  odometer_start NUMERIC,
  purpose TEXT NOT NULL,
  route TEXT,
  site_id TEXT,
  site_name TEXT,
  vehicle_id TEXT NOT NULL,
  vehicle_reg TEXT,
  workspace_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  created_at TEXT DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_number TEXT,
  status TEXT,
  type TEXT,
  updated_at TEXT DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waybills (
  created_at TEXT DEFAULT now(),
  created_by TEXT,
  driver_name TEXT,
  expected_return_date TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_date TEXT NOT NULL,
  items JSONB,
  purpose TEXT NOT NULL,
  return_to_site_id TEXT,
  sent_to_site_date TEXT,
  service TEXT NOT NULL,
  site_id TEXT,
  status TEXT,
  type TEXT,
  updated_at TEXT DEFAULT now(),
  vehicle TEXT
);

-- 1. operations_assets
CREATE TABLE IF NOT EXISTS public.operations_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  type TEXT DEFAULT 'equipment',
  quantity NUMERIC NOT NULL DEFAULT 0,
  available_quantity NUMERIC NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC DEFAULT 0,
  used_quantity NUMERIC DEFAULT 0,
  missing_quantity NUMERIC DEFAULT 0,
  damaged_quantity NUMERIC DEFAULT 0,
  unit TEXT NOT NULL,
  status TEXT,
  location TEXT,
  condition TEXT,
  description TEXT,
  requires_logging BOOLEAN,
  serial_number TEXT,
  service_interval_months NUMERIC,
  power_source TEXT,
  cost NUMERIC,
  low_stock_level NUMERIC,
  critical_stock_level NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. operations_waybills
CREATE TABLE IF NOT EXISTS public.operations_waybills (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  site_id TEXT,
  site_name TEXT,
  driver_name TEXT,
  vehicle TEXT,
  issue_date TEXT,
  sent_to_site_date TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. operations_checkouts
CREATE TABLE IF NOT EXISTS public.operations_checkouts (
  id TEXT PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name TEXT,
  asset_id UUID REFERENCES public.operations_assets(id) ON DELETE CASCADE,
  asset_name TEXT,
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL,
  checkout_date TEXT NOT NULL,
  expected_return_date TEXT,
  returned_quantity NUMERIC DEFAULT 0,
  return_in_days NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. operations_maintenance
CREATE TABLE IF NOT EXISTS public.operations_maintenance (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  technician TEXT NOT NULL,
  description TEXT,
  assets JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. operations_daily_logs
CREATE TABLE IF NOT EXISTS public.operations_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.operations_assets(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  site_name TEXT,
  date TEXT NOT NULL,
  is_active BOOLEAN,
  operational_day TEXT,
  downtime_entries JSONB NOT NULL DEFAULT '[]',
  maintenance_details TEXT,
  client_feedback TEXT,
  issues_on_site TEXT,
  diesel_usage NUMERIC,
  supervisor_on_site TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_asset_date UNIQUE (asset_id, date)
);
