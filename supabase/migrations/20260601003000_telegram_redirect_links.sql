CREATE TABLE IF NOT EXISTS public.telegram_redirect_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  slug text NOT NULL,
  slug_type text NOT NULL DEFAULT 'random',
  mode text NOT NULL DEFAULT 'random',
  active boolean NOT NULL DEFAULT true,
  cloaker boolean NOT NULL DEFAULT false,
  cloaker_v2 boolean NOT NULL DEFAULT false,
  domain text NOT NULL DEFAULT '',
  destination_type text NOT NULL DEFAULT 'bot',
  destination_bot_id uuid,
  destination_channel text,
  flow_ids uuid[] NOT NULL DEFAULT '{}',
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_redirect_links_slug_unique UNIQUE (slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_redirect_links TO authenticated;
GRANT SELECT ON public.telegram_redirect_links TO anon;
GRANT ALL ON public.telegram_redirect_links TO service_role;

ALTER TABLE public.telegram_redirect_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.telegram_redirect_links
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner_insert" ON public.telegram_redirect_links
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner_update" ON public.telegram_redirect_links
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner_delete" ON public.telegram_redirect_links
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "public_active_select" ON public.telegram_redirect_links
  FOR SELECT TO anon USING (active = true);

CREATE INDEX IF NOT EXISTS idx_telegram_redirect_links_user ON public.telegram_redirect_links(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_redirect_links_slug ON public.telegram_redirect_links(slug);
