CREATE TABLE IF NOT EXISTS public.gateway_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  public_key text NOT NULL,
  secret_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.gateway_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys"
  ON public.gateway_api_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys"
  ON public.gateway_api_keys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
  ON public.gateway_api_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_gateway_api_keys_updated_at
  BEFORE UPDATE ON public.gateway_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
