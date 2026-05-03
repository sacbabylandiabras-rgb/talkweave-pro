CREATE TABLE IF NOT EXISTS public.link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  campaign_id uuid,
  send_id uuid,
  phone text,
  flow_name text,
  btn_text text,
  ip text,
  country text,
  city text,
  region text,
  user_agent text,
  referer text,
  destination_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS link_clicks_campaign_idx ON public.link_clicks (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS link_clicks_user_idx ON public.link_clicks (user_id, created_at DESC);

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link clicks"
  ON public.link_clicks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert link clicks"
  ON public.link_clicks FOR INSERT
  WITH CHECK (true);
