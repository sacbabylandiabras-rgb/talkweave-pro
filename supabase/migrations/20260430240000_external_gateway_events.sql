-- External gateway events (Hotmart, Kiwify, Cakto, Eduzz, etc.)
CREATE TABLE IF NOT EXISTS public.external_gateway_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text,
  status text NOT NULL DEFAULT 'pending',
  amount integer NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'pix',
  customer_name text,
  customer_email text,
  customer_phone text,
  source text,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ext_gw_user ON public.external_gateway_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ext_gw_external ON public.external_gateway_events(user_id, external_id);

ALTER TABLE public.external_gateway_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own external events"
  ON public.external_gateway_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own external events"
  ON public.external_gateway_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Per-user webhook token
CREATE TABLE IF NOT EXISTS public.external_gateway_tokens (
  user_id uuid PRIMARY KEY,
  token text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_gateway_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own token"
  ON public.external_gateway_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own token"
  ON public.external_gateway_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
