-- Adicionando slot de 11:35 BRT (14:35 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-11h35');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('trigger-report-11h35', '35 14 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
