ALTER TABLE comm_logs ADD COLUMN parent_id UUID REFERENCES comm_logs(id);
