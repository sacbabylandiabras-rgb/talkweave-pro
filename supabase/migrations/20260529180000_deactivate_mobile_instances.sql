UPDATE public.zapi_instances
SET is_active = false, updated_at = now()
WHERE id IN (
  '88c2c902-3745-4ebb-89ae-2b7add93d00f',
  '79855c58-5c96-4d08-819e-fb5bdb4f3327'
);
