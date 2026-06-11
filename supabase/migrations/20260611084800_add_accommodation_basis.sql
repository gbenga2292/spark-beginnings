-- Add accommodation crew count basis to invoices and pending_invoices
-- When true: accommodation is calculated using the night shift crew count
-- When false (default): accommodation uses the day shift crew count
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technician_accommodation_use_night_count BOOLEAN DEFAULT FALSE;
ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS technician_accommodation_use_night_count BOOLEAN DEFAULT FALSE;
