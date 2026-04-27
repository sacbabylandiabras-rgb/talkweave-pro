-- Garante que callbacks de entrega possam casar pelo ID real da mensagem.
ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS message_id text;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_message_id
  ON public.campaign_sends (message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_user_message_id
  ON public.campaign_sends (user_id, message_id)
  WHERE message_id IS NOT NULL;
