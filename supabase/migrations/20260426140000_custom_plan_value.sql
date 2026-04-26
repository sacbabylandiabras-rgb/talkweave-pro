ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_plan_value integer;
