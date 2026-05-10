ALTER TABLE public.zapi_instances
  ADD COLUMN IF NOT EXISTS instance_type text NOT NULL DEFAULT 'web';

ALTER TABLE public.zapi_instances
  DROP CONSTRAINT IF EXISTS zapi_instances_instance_type_check;

ALTER TABLE public.zapi_instances
  ADD CONSTRAINT zapi_instances_instance_type_check
  CHECK (instance_type IN ('web', 'mobile'));
