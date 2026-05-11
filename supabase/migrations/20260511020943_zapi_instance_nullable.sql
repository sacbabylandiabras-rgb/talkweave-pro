ALTER TABLE public.zapi_instances 
  ALTER COLUMN zapi_instance_id DROP NOT NULL,
  ALTER COLUMN zapi_token DROP NOT NULL,
  ALTER COLUMN zapi_client_token DROP NOT NULL;
