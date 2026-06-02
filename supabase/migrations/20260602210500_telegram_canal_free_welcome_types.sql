-- Adiciona suporte para tipos de boas-vindas (texto, modelo, fluxo) no Canal Free
ALTER TABLE public.telegram_free_channels
  ADD COLUMN IF NOT EXISTS response_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS template_id uuid NULL,
  ADD COLUMN IF NOT EXISTS flow_id uuid NULL;

ALTER TABLE public.telegram_free_channels
  DROP CONSTRAINT IF EXISTS telegram_free_channels_response_type_check;
ALTER TABLE public.telegram_free_channels
  ADD CONSTRAINT telegram_free_channels_response_type_check
  CHECK (response_type IN ('text','template','flow'));
