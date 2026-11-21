-- TEKO STORE — daily cleanup for private ZIP orders older than 7 days.
-- Prerequisites (do these in Supabase Dashboard, NOT in GitHub):
-- 1. Deploy Edge Function 'teko-orders-cleanup' with Verify JWT = OFF.
-- 2. Add the same strong 32+ character random value in BOTH places:
--    a. Edge Function Secrets: TEKO_CRON_SECRET
--    b. Database Vault: secret name teko_cron_secret
-- 3. Enable pg_cron and pg_net (Integrations > Cron or Database > Extensions).
-- Never hardcode, print, or commit the secret value.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

DO $assert_vault$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.secrets
    WHERE name = 'teko_cron_secret'
  ) THEN
    RAISE EXCEPTION 'First create the Vault secret named teko_cron_secret';
  END IF;
END
$assert_vault$;

-- 03:15 UTC every day, using Supabase Cron.
-- cron.schedule is idempotent by job name (updates an existing job).
SELECT cron.schedule(
  'teko-orders-cleanup-daily',
  '15 3 * * *',
  $job$
    SELECT net.http_post(
      url := 'https://kopsyfhpcilafuesgjti.supabase.co/functions/v1/teko-orders-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-teko-cron-key', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'teko_cron_secret'
          LIMIT 1
        )
      ),
      body := '{"dryRun":false}'::jsonb,
      timeout_milliseconds := 30000
    ) AS request_id;
  $job$
);

-- Check the job is present; does not expose any secret:
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'teko-orders-cleanup-daily';

-- Inspect execution history:
-- SELECT status, start_time, end_time, return_message
-- FROM cron.job_run_details
-- WHERE jobid = (
--   SELECT jobid FROM cron.job WHERE jobname = 'teko-orders-cleanup-daily'
-- )
-- ORDER BY start_time DESC LIMIT 10;

-- To disable without deleting the job:
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname='teko-orders-cleanup-daily'),
--   active := false
-- );

-- To remove schedule completely:
-- SELECT cron.unschedule('teko-orders-cleanup-daily');
