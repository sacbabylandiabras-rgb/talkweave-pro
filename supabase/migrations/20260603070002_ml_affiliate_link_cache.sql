CREATE TABLE IF NOT EXISTS public.ml_affiliate_link_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_id text NOT NULL,
  original_url text NOT NULL,
  short_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_id, original_url)
);

CREATE INDEX IF NOT EXISTS idx_ml_aff_cache_lookup
  ON public.ml_affiliate_link_cache (user_id, source_id, original_url);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_affiliate_link_cache TO authenticated;
GRANT ALL ON public.ml_affiliate_link_cache TO service_role;

ALTER TABLE public.ml_affiliate_link_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own ml link cache"
  ON public.ml_affiliate_link_cache FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users insert own ml link cache"
  ON public.ml_affiliate_link_cache FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own ml link cache"
  ON public.ml_affiliate_link_cache FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
