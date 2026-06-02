-- Posts (envios) imediatos / agendados / recorrentes dentro do Canal Free.
CREATE TABLE IF NOT EXISTS public.telegram_channel_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  chat_id bigint,
  content_type text NOT NULL DEFAULT 'text',
  text text,
  media_url text,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_id uuid NULL,
  mode text NOT NULL DEFAULT 'now',
  scheduled_at timestamptz NULL,
  recurring_interval_minutes integer NULL,
  next_run_at timestamptz NULL,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  sent_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_channel_posts_content_type_check
    CHECK (content_type IN ('text','photo','video','document')),
  CONSTRAINT telegram_channel_posts_mode_check
    CHECK (mode IN ('now','scheduled','recurring')),
  CONSTRAINT telegram_channel_posts_status_check
    CHECK (status IN ('pending','sent','failed','paused','recurring'))
);

CREATE INDEX IF NOT EXISTS idx_tg_channel_posts_due
  ON public.telegram_channel_posts (next_run_at)
  WHERE status IN ('pending','recurring');

CREATE INDEX IF NOT EXISTS idx_tg_channel_posts_user_bot
  ON public.telegram_channel_posts (user_id, bot_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_channel_posts TO authenticated;
GRANT ALL ON public.telegram_channel_posts TO service_role;

ALTER TABLE public.telegram_channel_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users select own channel posts" ON public.telegram_channel_posts;
DROP POLICY IF EXISTS "users insert own channel posts" ON public.telegram_channel_posts;
DROP POLICY IF EXISTS "users update own channel posts" ON public.telegram_channel_posts;
DROP POLICY IF EXISTS "users delete own channel posts" ON public.telegram_channel_posts;

CREATE POLICY "users select own channel posts"
  ON public.telegram_channel_posts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users insert own channel posts"
  ON public.telegram_channel_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own channel posts"
  ON public.telegram_channel_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own channel posts"
  ON public.telegram_channel_posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_tg_channel_posts_updated ON public.telegram_channel_posts;
CREATE TRIGGER trg_tg_channel_posts_updated
  BEFORE UPDATE ON public.telegram_channel_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
