
-- =============================================
-- DCEL HR - Full Database Schema
-- =============================================

-- 1. PROFILES (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar TEXT,
  privileges JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Service role can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 2. APP SETTINGS (single-row config tables)
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_created BOOLEAN NOT NULL DEFAULT false,
  super_admin_signup_enabled BOOLEAN NOT NULL DEFAULT true,
  payroll_variables JSONB NOT NULL DEFAULT '{"basic":100,"housing":0,"transport":0,"otherAllowances":0,"employeePensionRate":8,"employerPensionRate":10,"withholdingTaxRate":0.05,"nsitfRate":1,"vatRate":7.5}',
  paye_tax_variables JSONB NOT NULL DEFAULT '{"craBase":800000,"rentReliefRate":0.20,"taxBrackets":[],"extraConditions":[]}',
  month_values JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can insert settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default settings row
INSERT INTO public.app_settings (id) VALUES (gen_random_uuid());

-- 3. PRIVILEGE PRESETS
CREATE TABLE public.privilege_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  privileges JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.privilege_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage presets" ON public.privilege_presets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage clients" ON public.clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. SITES
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  vat TEXT NOT NULL DEFAULT 'No',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage sites" ON public.sites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. POSITIONS
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage positions" ON public.positions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. DEPARTMENTS
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage departments" ON public.departments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. EMPLOYEES
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surname TEXT NOT NULL,
  firstname TEXT NOT NULL,
  department TEXT NOT NULL,
  staff_type TEXT NOT NULL DEFAULT 'INTERNAL',
  position TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  yearly_leave INT NOT NULL DEFAULT 20,
  bank_name TEXT NOT NULL DEFAULT '',
  account_no TEXT NOT NULL DEFAULT '',
  paye_tax BOOLEAN NOT NULL DEFAULT false,
  withholding_tax BOOLEAN NOT NULL DEFAULT false,
  tax_id TEXT NOT NULL DEFAULT '',
  pension_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  monthly_salaries JSONB NOT NULL DEFAULT '{"jan":0,"feb":0,"mar":0,"apr":0,"may":0,"jun":0,"jul":0,"aug":0,"sep":0,"oct":0,"nov":0,"dec":0}',
  avatar TEXT,
  exclude_from_onboarding BOOLEAN NOT NULL DEFAULT false,
  rent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage employees" ON public.employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. ATTENDANCE RECORDS
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  staff_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  day_client TEXT NOT NULL DEFAULT '',
  day_site TEXT NOT NULL DEFAULT '',
  night_client TEXT NOT NULL DEFAULT '',
  night_site TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL DEFAULT 'No',
  night TEXT NOT NULL DEFAULT 'No',
  absent_status TEXT NOT NULL DEFAULT '',
  night_wk INT NOT NULL DEFAULT 0,
  ot INT NOT NULL DEFAULT 0,
  ot_site TEXT NOT NULL DEFAULT '',
  day_wk INT NOT NULL DEFAULT 0,
  dow INT NOT NULL DEFAULT 0,
  ndw TEXT NOT NULL DEFAULT 'No',
  mth INT NOT NULL DEFAULT 0,
  is_present TEXT NOT NULL DEFAULT 'No',
  day2 INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage attendance" ON public.attendance_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_attendance_staff_mth ON public.attendance_records(staff_id, mth);
CREATE INDEX idx_attendance_date ON public.attendance_records(date);

-- 10. INVOICES
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT '',
  site_id TEXT NOT NULL DEFAULT '',
  site_name TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  billing_cycle TEXT NOT NULL DEFAULT 'Monthly',
  reminder_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft',
  vat_inc TEXT,
  no_of_machine INT,
  daily_rental_cost NUMERIC,
  diesel_cost_per_ltr NUMERIC,
  daily_usage NUMERIC,
  no_of_technician INT,
  technicians_daily_rate NUMERIC,
  mob_demob NUMERIC,
  installation NUMERIC,
  damages NUMERIC,
  duration INT,
  rental_cost NUMERIC,
  diesel_cost NUMERIC,
  technicians_cost NUMERIC,
  total_cost NUMERIC,
  vat NUMERIC,
  total_charge NUMERIC,
  total_exclusive_of_vat NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage invoices" ON public.invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. PENDING INVOICES
CREATE TABLE public.pending_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL,
  site TEXT NOT NULL DEFAULT '',
  vat_inc TEXT NOT NULL DEFAULT 'No',
  no_of_machine INT NOT NULL DEFAULT 0,
  daily_rental_cost NUMERIC NOT NULL DEFAULT 0,
  diesel_cost_per_ltr NUMERIC NOT NULL DEFAULT 0,
  daily_usage NUMERIC NOT NULL DEFAULT 0,
  no_of_technician INT NOT NULL DEFAULT 0,
  technicians_daily_rate NUMERIC NOT NULL DEFAULT 0,
  mob_demob NUMERIC NOT NULL DEFAULT 0,
  installation NUMERIC NOT NULL DEFAULT 0,
  damages NUMERIC NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL DEFAULT '',
  duration INT NOT NULL DEFAULT 0,
  end_date TEXT NOT NULL DEFAULT '',
  rental_cost NUMERIC NOT NULL DEFAULT 0,
  diesel_cost NUMERIC NOT NULL DEFAULT 0,
  technicians_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  vat NUMERIC NOT NULL DEFAULT 0,
  total_charge NUMERIC NOT NULL DEFAULT 0,
  total_exclusive_of_vat NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage pending_invoices" ON public.pending_invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. SALARY ADVANCES
CREATE TABLE public.salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  request_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage salary_advances" ON public.salary_advances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 13. LOANS
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL DEFAULT '',
  loan_type TEXT NOT NULL DEFAULT '',
  principal_amount NUMERIC NOT NULL DEFAULT 0,
  monthly_deduction NUMERIC NOT NULL DEFAULT 0,
  duration INT NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL DEFAULT '',
  payment_start_date TEXT NOT NULL DEFAULT '',
  remaining_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage loans" ON public.loans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 14. PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client TEXT NOT NULL,
  site TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  withholding_tax NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  pay_vat TEXT NOT NULL DEFAULT 'No',
  vat NUMERIC NOT NULL DEFAULT 0,
  amount_for_vat NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage payments" ON public.payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 15. VAT PAYMENTS
CREATE TABLE public.vat_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  month TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vat_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage vat_payments" ON public.vat_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 16. PUBLIC HOLIDAYS
CREATE TABLE public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage public_holidays" ON public.public_holidays
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 17. DEPARTMENT TASKS
CREATE TABLE public.department_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  onboarding_tasks JSONB NOT NULL DEFAULT '[]',
  offboarding_tasks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage department_tasks" ON public.department_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 18. LEAVES
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL DEFAULT '',
  leave_type TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  duration INT NOT NULL DEFAULT 0,
  expected_end_date TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  date_returned TEXT NOT NULL DEFAULT '',
  can_be_contacted TEXT NOT NULL DEFAULT 'No',
  status TEXT NOT NULL DEFAULT 'Active',
  uploaded_file TEXT,
  uploaded_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage leaves" ON public.leaves
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 19. LEAVE TYPES
CREATE TABLE public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage leave_types" ON public.leave_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
