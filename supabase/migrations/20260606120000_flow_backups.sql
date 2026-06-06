-- Tabela de backups automáticos dos fluxos visuais
CREATE TABLE IF NOT EXISTS public.flow_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  flow_name text NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_backups_flow_id ON public.flow_backups(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_backups_user_id ON public.flow_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_backups_backed_up_at ON public.flow_backups(backed_up_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_backups TO authenticated;
GRANT ALL ON public.flow_backups TO service_role;

ALTER TABLE public.flow_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flow backups"
  ON public.flow_backups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flow backups"
  ON public.flow_backups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flow backups"
  ON public.flow_backups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
