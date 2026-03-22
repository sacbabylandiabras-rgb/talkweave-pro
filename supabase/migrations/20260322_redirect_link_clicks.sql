-- Table to track clicks/accesses on redirect links
CREATE TABLE IF NOT EXISTS public.redirect_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redirect_link_id uuid NOT NULL REFERENCES public.redirect_links(id) ON DELETE CASCADE,
  group_redirected_to text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast counting per link
CREATE INDEX idx_redirect_link_clicks_link_id ON public.redirect_link_clicks(redirect_link_id);

-- RLS: service role inserts (from edge function), authenticated users read their own
ALTER TABLE public.redirect_link_clicks ENABLE ROW LEVEL SECURITY;

-- Allow edge function (service role) to insert
CREATE POLICY "Service role can insert clicks"
  ON public.redirect_link_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view clicks for their own links
CREATE POLICY "Users can view clicks for own links"
  ON public.redirect_link_clicks
  FOR SELECT
  TO authenticated
  USING (
    redirect_link_id IN (
      SELECT id FROM public.redirect_links WHERE user_id = auth.uid()
    )
  );
