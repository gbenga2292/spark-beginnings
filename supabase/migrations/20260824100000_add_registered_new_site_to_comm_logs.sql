-- Add registered_new_site flag to comm_logs to track logs that initiated or registered a new site
ALTER TABLE public.comm_logs ADD COLUMN IF NOT EXISTS registered_new_site BOOLEAN DEFAULT false;
