-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the automated tasks edge function to run daily at midnight (UTC)
-- NOTE: You will need to replace YOUR_PROJECT_REF and YOUR_ANON_KEY with your actual project details,
-- or you can configure this directly in the Supabase Dashboard under Database -> Cron Jobs.
SELECT cron.schedule(
  'invoke-automated-tasks',
  '0 0 * * *',
  $$
  SELECT net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/automated-tasks',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )
  $$
);
