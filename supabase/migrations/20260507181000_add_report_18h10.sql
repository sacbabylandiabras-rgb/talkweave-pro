-- Adicionando slot de 18:10 BRT (21:10 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-18h10');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('trigger-report-18h10', '10 21 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
