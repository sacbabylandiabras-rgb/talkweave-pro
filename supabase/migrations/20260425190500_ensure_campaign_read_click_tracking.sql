ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_read_at
  ON public.campaign_sends (campaign_id, read_at)
  WHERE read_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_clicked_at
  ON public.campaign_sends (campaign_id, clicked_at)
  WHERE clicked_at IS NOT NULL;
