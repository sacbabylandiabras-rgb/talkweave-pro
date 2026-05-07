-- Adicionando slot de 18:20 BRT (21:20 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-18h20');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('trigger-report-18h20', '20 21 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
