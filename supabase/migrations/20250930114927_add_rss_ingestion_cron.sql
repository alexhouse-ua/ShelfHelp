-- Enable required extensions for pg_cron and HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store Supabase project credentials in Vault for cron job authentication
-- Note: These secrets should be set manually via Supabase Dashboard or CLI
-- This is just a placeholder to document the required secrets
--
-- To set these secrets, run:
-- SELECT vault.create_secret('YOUR_PROJECT_URL', 'project_url');
-- SELECT vault.create_secret('YOUR_ANON_KEY', 'anon_key');
--
-- Or use Supabase CLI:
-- supabase secrets set project_url="https://YOUR_PROJECT_REF.supabase.co"
-- supabase secrets set anon_key="YOUR_ANON_KEY"

-- Unschedule any existing job with the same name (for idempotency)
-- Use DO block to handle case where job doesn't exist
DO $$
BEGIN
  PERFORM cron.unschedule('rss-ingestion-daily');
EXCEPTION
  WHEN others THEN
    NULL; -- Job doesn't exist, ignore error
END $$;

-- Clean up any lingering cron.job rows with the same name (covers legacy schedules)
DELETE FROM cron.job WHERE jobname = 'rss-ingestion-daily';

-- Schedule RSS ingestion to run daily at 2 AM UTC
SELECT cron.schedule(
  'rss-ingestion-daily',              -- Job name
  '0 2 * * *',                        -- Cron expression (2 AM UTC daily)
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/rss-ingestion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := jsonb_build_object('trigger', 'cron', 'time', now())
  ) AS request_id;
  $$
);
