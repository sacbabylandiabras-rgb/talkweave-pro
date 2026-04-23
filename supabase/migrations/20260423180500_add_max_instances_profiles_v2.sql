ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_instances integer NOT NULL DEFAULT 1;
