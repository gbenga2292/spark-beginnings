-- Add technician night fields to invoices and pending_invoices tables
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technician_night_fee NUMERIC NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technician_accommodation NUMERIC NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technician_night_duration INTEGER NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technician_night_duration_same_as_machine BOOLEAN DEFAULT TRUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS no_of_technician_night INTEGER NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technician_night_count_same_as_day BOOLEAN DEFAULT TRUE;

ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS technician_night_fee NUMERIC NULL;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS technician_accommodation NUMERIC NULL;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS technician_night_duration INTEGER NULL;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS technician_night_duration_same_as_machine BOOLEAN DEFAULT TRUE;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS no_of_technician_night INTEGER NULL;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS technician_night_count_same_as_day BOOLEAN DEFAULT TRUE;
