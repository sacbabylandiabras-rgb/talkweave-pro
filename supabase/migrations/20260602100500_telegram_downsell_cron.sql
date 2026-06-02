-- Schedule downsell tick every minute
DO $$
BEGIN
  PERFORM cron.unschedule('telegram-downsell-tick-1min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'telegram-downsell-tick-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/telegram-downsell-tick',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
