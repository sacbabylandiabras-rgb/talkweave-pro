CREATE TABLE IF NOT EXISTS public.tg_custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hostname text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  ssl_status text,
  verification jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tg_custom_domains TO authenticated;
GRANT ALL ON public.tg_custom_domains TO service_role;
ALTER TABLE public.tg_custom_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tg_custom_domains_select_own" ON public.tg_custom_domains FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "tg_custom_domains_insert_own" ON public.tg_custom_domains FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tg_custom_domains_update_own" ON public.tg_custom_domains FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "tg_custom_domains_delete_own" ON public.tg_custom_domains FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_tg_custom_domains_user ON public.tg_custom_domains(user_id);
DROP TRIGGER IF EXISTS trg_tg_custom_domains_updated ON public.tg_custom_domains;
CREATE TRIGGER trg_tg_custom_domains_updated BEFORE UPDATE ON public.tg_custom_domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
