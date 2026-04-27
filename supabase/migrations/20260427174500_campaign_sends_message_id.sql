-- Adiciona coluna message_id em campaign_sends para vincular callbacks
-- de status (DELIVERED/READ) ao registro original, especialmente útil quando
-- o destinatário foi enviado como @lid mas o callback retorna o número real.
ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS message_id text;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_message_id
  ON public.campaign_sends (message_id)
  WHERE message_id IS NOT NULL;
