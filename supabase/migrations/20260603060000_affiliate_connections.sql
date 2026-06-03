CREATE TABLE IF NOT EXISTS public.affiliate_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  account_id text,
  account_nickname text,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expires_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_connections TO authenticated;
GRANT ALL ON public.affiliate_connections TO service_role;

ALTER TABLE public.affiliate_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own affiliate connections"
  ON public.affiliate_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own affiliate connections"
  ON public.affiliate_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_connections_user_provider
  ON public.affiliate_connections (user_id, provider);

CREATE TABLE IF NOT EXISTS public.affiliate_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  redirect_uri text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.affiliate_oauth_states TO service_role;
ALTER TABLE public.affiliate_oauth_states ENABLE ROW LEVEL SECURITY;
