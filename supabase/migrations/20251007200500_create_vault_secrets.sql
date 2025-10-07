-- Create vault secrets for pg_cron to use when calling Edge Functions
-- These secrets are used by the cron jobs to authenticate HTTP requests

-- Create project_url secret (Supabase project URL) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret('https://wyzuelwotgyoautxjpxv.supabase.co', 'project_url');
  END IF;
END $$;

-- Create anon_key secret (Supabase anon key for authorization) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'anon_key') THEN
    PERFORM vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5enVlbHdvdGd5b2F1dHhqcHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODY0ODAsImV4cCI6MjA3NDc2MjQ4MH0.KkklGsyLf27_ZptH4m6YlmqUaxS3BVGDWsgstXB5ug0', 'anon_key');
  END IF;
END $$;
