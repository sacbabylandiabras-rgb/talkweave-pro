-- Telegram Flow Visual: support for visual flows targeting Telegram bots

ALTER TABLE public.flow_automations
  ADD COLUMN IF NOT EXISTS bot_id uuid REFERENCES public.telegram_bots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_flow_automations_category_user
  ON public.flow_automations (user_id, category);

CREATE INDEX IF NOT EXISTS idx_flow_automations_bot_id
  ON public.flow_automations (bot_id) WHERE bot_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.telegram_flow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chat_id bigint NOT NULL,
  flow_id uuid REFERENCES public.flow_automations(id) ON DELETE SET NULL,
  current_node_id text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  waiting_for text,
  waiting_var text,
  last_update_id bigint,
  resume_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_flow_sessions_user_id
  ON public.telegram_flow_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_flow_sessions_resume
  ON public.telegram_flow_sessions (resume_at) WHERE resume_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telegram_flow_sessions_status
  ON public.telegram_flow_sessions (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_flow_sessions TO authenticated;
GRANT ALL ON public.telegram_flow_sessions TO service_role;

ALTER TABLE public.telegram_flow_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own telegram flow sessions" ON public.telegram_flow_sessions;
CREATE POLICY "Users manage their own telegram flow sessions"
  ON public.telegram_flow_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_telegram_flow_sessions_updated_at ON public.telegram_flow_sessions;
CREATE TRIGGER trg_telegram_flow_sessions_updated_at
  BEFORE UPDATE ON public.telegram_flow_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
