-- Add read_at and clicked_at columns to campaign_sends
ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_read_at
  ON public.campaign_sends (campaign_id, read_at);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_clicked_at
  ON public.campaign_sends (campaign_id, clicked_at);
