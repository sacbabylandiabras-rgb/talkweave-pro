CREATE TABLE IF NOT EXISTS public.warmup_user_controls (
  user_id UUID PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT false,
  run_id TEXT,
  instance_ids TEXT[] NOT NULL DEFAULT '{}',
  min_delay INTEGER NOT NULL DEFAULT 30,
  max_delay INTEGER NOT NULL DEFAULT 120,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warmup_user_controls_active
  ON public.warmup_user_controls(active);

ALTER TABLE public.warmup_user_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own warmup control" ON public.warmup_user_controls;
CREATE POLICY "Users manage own warmup control"
  ON public.warmup_user_controls
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS warmup_user_controls_updated_at ON public.warmup_user_controls;
CREATE TRIGGER warmup_user_controls_updated_at
  BEFORE UPDATE ON public.warmup_user_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
