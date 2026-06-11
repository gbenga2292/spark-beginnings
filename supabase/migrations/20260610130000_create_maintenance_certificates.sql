-- Create maintenance_certificates table
CREATE TABLE IF NOT EXISTS public.maintenance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_number TEXT NOT NULL UNIQUE,
  machine_id TEXT NOT NULL,
  machine_name TEXT NOT NULL,
  machine_category TEXT NOT NULL CHECK (machine_category IN ('machine', 'vehicle')),
  machine_site TEXT,
  machine_serial TEXT,
  issued_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  issued_by_employee_id TEXT,
  issued_by_name TEXT NOT NULL,
  issued_by_designation TEXT,
  last_service_date TEXT,
  next_service_date TEXT,
  total_services INTEGER DEFAULT 0,
  compliance_standards TEXT,
  conditions_of_operation TEXT,
  manufacturer TEXT,
  model_number TEXT,
  outcome_remarks TEXT,
  last_inspection_date_override TEXT,
  issued_date_override TEXT,
  criteria_compliance JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.maintenance_certificates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all certificates
CREATE POLICY "Authenticated users can read certificates"
  ON public.maintenance_certificates
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert certificates
CREATE POLICY "Authenticated users can insert certificates"
  ON public.maintenance_certificates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update certificates
CREATE POLICY "Authenticated users can update certificates"
  ON public.maintenance_certificates
  FOR UPDATE
  TO authenticated
  USING (true);
