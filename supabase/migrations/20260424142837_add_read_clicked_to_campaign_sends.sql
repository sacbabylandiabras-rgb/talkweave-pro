-- Add read_at and clicked_at tracking to campaign_sends
ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_read_at ON public.campaign_sends(read_at) WHERE read_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_sends_clicked_at ON public.campaign_sends(clicked_at) WHERE clicked_at IS NOT NULL;
