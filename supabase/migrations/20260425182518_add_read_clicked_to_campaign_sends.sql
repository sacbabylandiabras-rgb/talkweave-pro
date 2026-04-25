ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_read_at ON public.campaign_sends(read_at);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_clicked_at ON public.campaign_sends(clicked_at);
