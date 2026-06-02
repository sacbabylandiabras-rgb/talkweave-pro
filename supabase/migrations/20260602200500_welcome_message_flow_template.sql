-- Add support for template and flow responses in welcome message config
ALTER TABLE public.welcome_message_config
  ADD COLUMN IF NOT EXISTS response_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS flow_id uuid,
  ADD COLUMN IF NOT EXISTS instance_id text;

ALTER TABLE public.welcome_message_config
  DROP CONSTRAINT IF EXISTS welcome_message_config_response_type_check;

ALTER TABLE public.welcome_message_config
  ADD CONSTRAINT welcome_message_config_response_type_check
  CHECK (response_type IN ('text', 'template', 'flow'));
