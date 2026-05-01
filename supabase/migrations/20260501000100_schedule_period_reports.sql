-- Garante extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior se existir
DO $$
BEGIN
  PERFORM cron.unschedule('send-period-reports-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Roda no minuto 0 de toda hora; a função decide se está num slot (00/08/12/18 BRT = 03/11/15/21 UTC)
SELECT cron.schedule(
  'send-period-reports-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/send-period-reports',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);
