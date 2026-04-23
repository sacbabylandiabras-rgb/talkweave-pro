-- Add tracking columns for read/click metrics on campaign_sends
ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS clicked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_phone
  ON public.campaign_sends (campaign_id, phone);
