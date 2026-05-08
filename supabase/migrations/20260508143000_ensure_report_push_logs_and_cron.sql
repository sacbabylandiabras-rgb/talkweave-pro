-- 1. Ensure report_push_logs exists (it was missing from public tables)
CREATE TABLE IF NOT EXISTS public.report_push_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_key TEXT NOT NULL,
    messages_sent INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    sales_amount BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_report_push_logs_user_slot ON public.report_push_logs (user_id, slot_key);

ALTER TABLE public.report_push_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_push_logs' AND policyname = 'Users can view their own report logs') THEN
        CREATE POLICY "Users can view their own report logs" ON public.report_push_logs
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_push_logs' AND policyname = 'Service role can manage all report logs') THEN
        CREATE POLICY "Service role can manage all report logs" ON public.report_push_logs
            USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2. Ensure notification_preferences has the UNIQUE constraint for user_id to allow upsert
ALTER TABLE public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_key;
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);

-- 3. Reschedule cron jobs with correct URL and headers
DO $$
BEGIN
  PERFORM cron.unschedule('trigger-report-00h');
  PERFORM cron.unschedule('trigger-report-08h');
  PERFORM cron.unschedule('trigger-report-12h');
  PERFORM cron.unschedule('trigger-report-16h30');
  PERFORM cron.unschedule('trigger-report-18h');
  PERFORM cron.unschedule('trigger-report-18h10');
  PERFORM cron.unschedule('trigger-report-18h20');
  PERFORM cron.unschedule('send-period-reports-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Scheduled reports (UTC-3 BRT)
-- 00:00 BRT = 03:00 UTC
SELECT cron.schedule('trigger-report-00h', '0 3 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- 08:00 BRT = 11:00 UTC
SELECT cron.schedule('trigger-report-08h', '0 11 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- 12:00 BRT = 15:00 UTC
SELECT cron.schedule('trigger-report-12h', '0 15 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- 16:30 BRT = 19:30 UTC
SELECT cron.schedule('trigger-report-16h30', '30 19 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- 18:00 BRT = 21:00 UTC
SELECT cron.schedule('trigger-report-18h', '0 21 * * *', $$
  SELECT net.http_post(
    url := 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/trigger-report-slot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
