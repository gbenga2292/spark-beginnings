-- Migration: Create payslip_email_logs table
CREATE TABLE IF NOT EXISTS payslip_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_code TEXT,
  recipient_email TEXT NOT NULL,
  year INT NOT NULL,
  months TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'SENT',
  error_message TEXT,
  provider TEXT NOT NULL DEFAULT 'resend',
  message_id TEXT,
  sent_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payslip_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read and insert payslip_email_logs" ON payslip_email_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_payslip_email_logs_emp ON payslip_email_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslip_email_logs_year ON payslip_email_logs(year);

