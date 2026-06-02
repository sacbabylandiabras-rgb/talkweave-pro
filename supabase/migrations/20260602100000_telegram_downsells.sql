-- Telegram Downsells: config + pending sales + dedup

CREATE TABLE IF NOT EXISTS public.telegram_downsells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bot_id uuid REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  plano text NOT NULL DEFAULT 'Mensal',
  valor_promocional numeric NOT NULL DEFAULT 0,
  minutos integer NOT NULL DEFAULT 30,
  mensagem text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'no_purchase',
  button_label text,
  button_url text,
  status boolean NOT NULL DEFAULT true,
  vendas_quant integer NOT NULL DEFAULT 0,
  vendas_val numeric NOT NULL DEFAULT 0,
  cliques integer NOT NULL DEFAULT 0,
  envios integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tg_downsells_user ON public.telegram_downsells(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_downsells_bot ON public.telegram_downsells(bot_id) WHERE status = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_downsells TO authenticated;
GRANT ALL ON public.telegram_downsells TO service_role;
ALTER TABLE public.telegram_downsells ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own telegram_downsells" ON public.telegram_downsells
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access tg_downsells" ON public.telegram_downsells
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.telegram_pending_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bot_id uuid REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  plano text,
  amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_tg_pending_bot_status ON public.telegram_pending_sales(bot_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_tg_pending_chat ON public.telegram_pending_sales(chat_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_pending_sales TO authenticated;
GRANT ALL ON public.telegram_pending_sales TO service_role;
ALTER TABLE public.telegram_pending_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tg_pending_sales" ON public.telegram_pending_sales
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access tg_pending_sales" ON public.telegram_pending_sales
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.telegram_downsell_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  downsell_id uuid NOT NULL REFERENCES public.telegram_downsells(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL,
  chat_id bigint NOT NULL,
  pending_sale_id uuid REFERENCES public.telegram_pending_sales(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tg_downsell_sent_pending
  ON public.telegram_downsell_sent(downsell_id, pending_sale_id)
  WHERE pending_sale_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tg_downsell_sent_chat
  ON public.telegram_downsell_sent(downsell_id, chat_id)
  WHERE pending_sale_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tg_downsell_sent_lookup ON public.telegram_downsell_sent(downsell_id, chat_id);

GRANT SELECT, INSERT ON public.telegram_downsell_sent TO authenticated;
GRANT ALL ON public.telegram_downsell_sent TO service_role;
ALTER TABLE public.telegram_downsell_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view via downsell ownership" ON public.telegram_downsell_sent
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_downsells d WHERE d.id = downsell_id AND d.user_id = auth.uid()));
CREATE POLICY "Service role full access tg_downsell_sent" ON public.telegram_downsell_sent
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_tg_downsells_updated_at
  BEFORE UPDATE ON public.telegram_downsells
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
