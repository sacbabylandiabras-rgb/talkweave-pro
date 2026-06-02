-- Tabela de modelos de mensagem do Telegram
CREATE TABLE IF NOT EXISTS public.telegram_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  parse_mode text NOT NULL DEFAULT 'HTML',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_message_templates TO authenticated;
GRANT ALL ON public.telegram_message_templates TO service_role;

ALTER TABLE public.telegram_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tg tpl select own" ON public.telegram_message_templates;
DROP POLICY IF EXISTS "tg tpl insert own" ON public.telegram_message_templates;
DROP POLICY IF EXISTS "tg tpl update own" ON public.telegram_message_templates;
DROP POLICY IF EXISTS "tg tpl delete own" ON public.telegram_message_templates;

CREATE POLICY "tg tpl select own"
  ON public.telegram_message_templates FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tg tpl insert own"
  ON public.telegram_message_templates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tg tpl update own"
  ON public.telegram_message_templates FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tg tpl delete own"
  ON public.telegram_message_templates FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_telegram_message_templates_updated ON public.telegram_message_templates;
CREATE TRIGGER trg_telegram_message_templates_updated
  BEFORE UPDATE ON public.telegram_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
