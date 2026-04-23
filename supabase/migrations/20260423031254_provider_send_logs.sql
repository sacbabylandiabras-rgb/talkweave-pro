-- Tabela para logs estruturados por provider (UAZAPI vs Z-API)
CREATE TABLE IF NOT EXISTS public.provider_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  instance_id text,
  phone text,
  endpoint text,
  status text NOT NULL,
  http_status integer,
  error_message text,
  duration_ms integer,
  payload_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_send_logs_user_created ON public.provider_send_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_send_logs_provider ON public.provider_send_logs(provider, status);

ALTER TABLE public.provider_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own provider_send_logs"
  ON public.provider_send_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access provider_send_logs"
  ON public.provider_send_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
