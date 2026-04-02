ALTER TABLE public.group_welcome_config
ADD COLUMN IF NOT EXISTS instance_id text DEFAULT NULL;
