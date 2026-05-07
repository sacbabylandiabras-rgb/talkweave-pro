-- Remove existing jobs to avoid duplicates if they were somehow created
DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-00h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-08h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-12h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-16h30');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-18h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agendar os relatórios para os horários específicos em BRT
-- 00:00 BRT = 03:00 UTC
SELECT cron.schedule('trigger-report-00h', '0 3 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- 08:00 BRT = 11:00 UTC
SELECT cron.schedule('trigger-report-08h', '0 11 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- 12:00 BRT = 15:00 UTC
SELECT cron.schedule('trigger-report-12h', '0 15 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- 16:30 BRT = 19:30 UTC
SELECT cron.schedule('trigger-report-16h30', '30 19 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- 18:00 BRT = 21:00 UTC
SELECT cron.schedule('trigger-report-18h', '0 21 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
