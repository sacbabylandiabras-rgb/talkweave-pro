-- Fluxos de envio dentro do grupo de prévia (Canal Free)

CREATE TABLE IF NOT EXISTS public.telegram_group_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Novo fluxo',
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual','scheduled','recurring','keyword')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_node_id text,
  is_active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_group_flows_user ON public.telegram_group_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_group_flows_bot ON public.telegram_group_flows(bot_id);
CREATE INDEX IF NOT EXISTS idx_tg_group_flows_trigger ON public.telegram_group_flows(trigger_type, is_active);
CREATE INDEX IF NOT EXISTS idx_tg_group_flows_next_run ON public.telegram_group_flows(next_run_at) WHERE next_run_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_group_flows TO authenticated;
GRANT ALL ON public.telegram_group_flows TO service_role;

ALTER TABLE public.telegram_group_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_group_flows" ON public.telegram_group_flows
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner_insert_group_flows" ON public.telegram_group_flows
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner_update_group_flows" ON public.telegram_group_flows
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner_delete_group_flows" ON public.telegram_group_flows
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_tg_group_flows_updated_at ON public.telegram_group_flows;
CREATE TRIGGER trg_tg_group_flows_updated_at
  BEFORE UPDATE ON public.telegram_group_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.telegram_group_flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.telegram_group_flows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  bot_id uuid NOT NULL,
  chat_id bigint NOT NULL,
  triggered_by_user_id bigint,
  triggered_by_username text,
  trigger_source text,
  current_node_id text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','paused')),
  next_run_at timestamptz,
  last_error text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  step_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_group_flow_runs_flow ON public.telegram_group_flow_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_tg_group_flow_runs_user ON public.telegram_group_flow_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_group_flow_runs_pending
  ON public.telegram_group_flow_runs(next_run_at)
  WHERE status = 'running';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_group_flow_runs TO authenticated;
GRANT ALL ON public.telegram_group_flow_runs TO service_role;

ALTER TABLE public.telegram_group_flow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_group_flow_runs" ON public.telegram_group_flow_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner_delete_group_flow_runs" ON public.telegram_group_flow_runs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_tg_group_flow_runs_updated_at ON public.telegram_group_flow_runs;
CREATE TRIGGER trg_tg_group_flow_runs_updated_at
  BEFORE UPDATE ON public.telegram_group_flow_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
