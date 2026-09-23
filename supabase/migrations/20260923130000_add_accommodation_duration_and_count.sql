-- Add separate accommodation headcount, duration, and link controls to invoices and pending_invoices
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS no_of_technician_accommodation NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS technician_accommodation_count_same_as_day BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS technician_accommodation_duration NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS technician_accommodation_duration_same_as_day BOOLEAN DEFAULT TRUE;

ALTER TABLE pending_invoices 
  ADD COLUMN IF NOT EXISTS no_of_technician_accommodation NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS technician_accommodation_count_same_as_day BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS technician_accommodation_duration NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS technician_accommodation_duration_same_as_day BOOLEAN DEFAULT TRUE;
