CREATE TABLE IF NOT EXISTS public.flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id uuid,
  flow_name text,
  recipient text,
  status text NOT NULL,
  start_time bigint,
  end_time bigint,
  duration integer,
  nodes_processed integer DEFAULT 0,
  nodes_total integer DEFAULT 0,
  error_message text,
  last_node_id text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_id ON public.flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_user_id ON public.flow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_executed_at ON public.flow_executions(executed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_executions TO authenticated;
GRANT ALL ON public.flow_executions TO service_role;

ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flow executions"
  ON public.flow_executions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flow executions"
  ON public.flow_executions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own flow executions"
  ON public.flow_executions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
