CREATE TABLE IF NOT EXISTS public.warmup_instance_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_ref text NOT NULL,
  phone text,
  block_type text NOT NULL DEFAULT 'new_chat_capping',
  blocked_until timestamptz,
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_ref, block_type)
);

CREATE INDEX IF NOT EXISTS warmup_instance_health_phone_idx
  ON public.warmup_instance_health (phone);

ALTER TABLE public.warmup_instance_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warmup_instance_health read all auth"
  ON public.warmup_instance_health
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "warmup_instance_health admins manage"
  ON public.warmup_instance_health
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER warmup_instance_health_set_updated
  BEFORE UPDATE ON public.warmup_instance_health
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
