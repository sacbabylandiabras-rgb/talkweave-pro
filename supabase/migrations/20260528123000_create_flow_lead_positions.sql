CREATE TABLE IF NOT EXISTS public.flow_lead_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id text NOT NULL,
  phone text NOT NULL,
  contact_name text,
  block_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  entered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flow_lead_positions_unique UNIQUE (user_id, flow_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_flp_flow ON public.flow_lead_positions(flow_id, status);
CREATE INDEX IF NOT EXISTS idx_flp_user ON public.flow_lead_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_flp_updated ON public.flow_lead_positions(updated_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_lead_positions TO authenticated;
GRANT ALL ON public.flow_lead_positions TO service_role;
ALTER TABLE public.flow_lead_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own lead positions" ON public.flow_lead_positions;
CREATE POLICY "Users view own lead positions" ON public.flow_lead_positions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own lead positions" ON public.flow_lead_positions;
CREATE POLICY "Users manage own lead positions" ON public.flow_lead_positions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE public.flow_lead_positions REPLICA IDENTITY FULL;
DO $$ BEGIN BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.flow_lead_positions'; EXCEPTION WHEN duplicate_object THEN NULL; END; END $$;
