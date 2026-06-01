ALTER TABLE public.telegram_redirect_links
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT '';
