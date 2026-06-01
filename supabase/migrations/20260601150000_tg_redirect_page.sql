ALTER TABLE public.telegram_redirect_links
  ADD COLUMN IF NOT EXISTS page_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_config jsonb NOT NULL DEFAULT '{}'::jsonb;
