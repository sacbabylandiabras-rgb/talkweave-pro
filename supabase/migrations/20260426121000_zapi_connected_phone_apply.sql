ALTER TABLE public.zapi_instances
  ADD COLUMN IF NOT EXISTS connected_phone text;
