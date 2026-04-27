CREATE TABLE IF NOT EXISTS public.telegram_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_token text NOT NULL,
  bot_id bigint,
  username text,
  first_name text,
  short_description text,
  description text,
  photo_url text,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bot_token)
);
CREATE INDEX IF NOT EXISTS idx_telegram_bots_user ON public.telegram_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_bots_active ON public.telegram_bots(active) WHERE active = true;
ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own telegram_bots" ON public.telegram_bots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own telegram_bots" ON public.telegram_bots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own telegram_bots" ON public.telegram_bots FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own telegram_bots" ON public.telegram_bots FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages telegram_bots" ON public.telegram_bots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.telegram_bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, command)
);
CREATE INDEX IF NOT EXISTS idx_tg_cmds_bot ON public.telegram_bot_commands(bot_id);
ALTER TABLE public.telegram_bot_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own tg_cmds" ON public.telegram_bot_commands FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tg_cmds" ON public.telegram_bot_commands FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tg_cmds" ON public.telegram_bot_commands FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tg_cmds" ON public.telegram_bot_commands FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.telegram_bot_state (
  bot_id uuid PRIMARY KEY REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  update_offset bigint NOT NULL DEFAULT 0,
  last_polled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages tg_bot_state" ON public.telegram_bot_state FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own tg_bot_state" ON public.telegram_bot_state FOR SELECT TO authenticated USING (bot_id IN (SELECT id FROM public.telegram_bots WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.telegram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  from_user_id bigint,
  from_username text,
  from_first_name text,
  text text,
  raw_update jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, update_id)
);
CREATE INDEX IF NOT EXISTS idx_tg_msgs_bot ON public.telegram_messages(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tg_msgs_chat ON public.telegram_messages(bot_id, chat_id);
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own tg_msgs" ON public.telegram_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tg_msgs" ON public.telegram_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages tg_msgs" ON public.telegram_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_tg_bots_updated ON public.telegram_bots;
CREATE TRIGGER trg_tg_bots_updated BEFORE UPDATE ON public.telegram_bots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
