-- Add read_at and clicked_at columns to campaign_sends for tracking message reads and link clicks
ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_read_at ON public.campaign_sends(read_at) WHERE read_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_sends_clicked_at ON public.campaign_sends(clicked_at) WHERE clicked_at IS NOT NULL;
