-- Permite vincular um fluxo a um grupo/canal específico (não apenas ao Canal Free)
ALTER TABLE public.telegram_group_flows
  ADD COLUMN IF NOT EXISTS chat_id bigint;

CREATE INDEX IF NOT EXISTS idx_tg_group_flows_chat_id
  ON public.telegram_group_flows(chat_id)
  WHERE chat_id IS NOT NULL;
