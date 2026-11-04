-- Add email_settings jsonb column to app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}'::jsonb;

