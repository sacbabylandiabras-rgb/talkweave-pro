-- Configuração do Canal Free por bot
CREATE TABLE IF NOT EXISTS public.telegram_free_channels (
  bot_id uuid PRIMARY KEY REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chat_id bigint,
  title text,
  welcome_message text NOT NULL DEFAULT '',
  approval_delay_seconds integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_free_channels TO authenticated;
GRANT ALL ON public.telegram_free_channels TO service_role;

ALTER TABLE public.telegram_free_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own free channels"
  ON public.telegram_free_channels FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users insert own free channels"
  ON public.telegram_free_channels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own free channels"
  ON public.telegram_free_channels FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users delete own free channels"
  ON public.telegram_free_channels FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_telegram_free_channels_updated
  BEFORE UPDATE ON public.telegram_free_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fila de solicitações de entrada pendentes
CREATE TABLE IF NOT EXISTS public.telegram_free_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chat_id bigint NOT NULL,
  from_user_id bigint NOT NULL,
  from_username text,
  from_first_name text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approve_at timestamptz NOT NULL,
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  UNIQUE (bot_id, chat_id, from_user_id, requested_at)
);

CREATE INDEX IF NOT EXISTS idx_tg_free_jr_pending
  ON public.telegram_free_join_requests (approve_at)
  WHERE status = 'pending';

GRANT SELECT ON public.telegram_free_join_requests TO authenticated;
GRANT ALL ON public.telegram_free_join_requests TO service_role;

ALTER TABLE public.telegram_free_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own join requests"
  ON public.telegram_free_join_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Cron para aprovar solicitações
DO $$
BEGIN
  PERFORM cron.unschedule('telegram-canal-free-tick-1min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'telegram-canal-free-tick-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/telegram-canal-free-tick',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
