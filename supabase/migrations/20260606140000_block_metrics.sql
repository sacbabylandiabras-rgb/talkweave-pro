CREATE TABLE IF NOT EXISTS public.block_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id uuid,
  block_id text NOT NULL,
  block_label text,
  block_type text,
  success boolean NOT NULL DEFAULT false,
  duration integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_block_metrics_flow_id ON public.block_metrics(flow_id);
CREATE INDEX IF NOT EXISTS idx_block_metrics_user_id ON public.block_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_block_metrics_block_id ON public.block_metrics(block_id);
CREATE INDEX IF NOT EXISTS idx_block_metrics_recorded_at ON public.block_metrics(recorded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_metrics TO authenticated;
GRANT ALL ON public.block_metrics TO service_role;

ALTER TABLE public.block_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own block metrics"
  ON public.block_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own block metrics"
  ON public.block_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own block metrics"
  ON public.block_metrics FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
