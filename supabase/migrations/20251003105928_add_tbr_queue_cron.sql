-- Migration for Story 2.1: Schedule TBR Queue Recalculation
-- Adds pg_cron job to invoke update-tbr-queue Edge Function daily

-- Unschedule any existing job with the same name (for idempotency)
DO $$
BEGIN
  PERFORM cron.unschedule('update-tbr-queue-daily');
EXCEPTION
  WHEN others THEN
    NULL; -- Job doesn't exist, ignore error
END $$;

-- Clean up any lingering cron.job rows with the same name
DO $$
DECLARE
  cleanup_job_id integer;
BEGIN
  FOR cleanup_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'update-tbr-queue-daily'
  LOOP
    PERFORM cron.remove_job(cleanup_job_id);
  END LOOP;
END $$;

-- Schedule TBR queue update to run daily at 3 AM UTC
-- Runs after RSS ingestion (2 AM) to incorporate newly added books
SELECT cron.schedule(
  'update-tbr-queue-daily',          -- Job name
  '0 3 * * *',                       -- Cron expression (3 AM UTC daily)
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/update-tbr-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := jsonb_build_object('trigger', 'cron', 'time', now())
  ) AS request_id;
  $$
);

-- Add comment documentation
COMMENT ON FUNCTION cron.schedule IS 'Schedules recurring jobs via pg_cron extension';
