ALTER TABLE public.telegram_redirect_links
  ADD COLUMN IF NOT EXISTS cloaker_block_method text NOT NULL DEFAULT 'page',
  ADD COLUMN IF NOT EXISTS cloaker_redirect_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cloaker_block_ads boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cloaker_anti_share boolean NOT NULL DEFAULT false;
