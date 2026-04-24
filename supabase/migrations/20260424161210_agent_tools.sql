CREATE TABLE IF NOT EXISTS public.agent_tools_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_name)
);

ALTER TABLE public.agent_tools_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own agent tools" ON public.agent_tools_config
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own agent tools" ON public.agent_tools_config
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own agent tools" ON public.agent_tools_config
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own agent tools" ON public.agent_tools_config
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER agent_tools_config_updated_at
  BEFORE UPDATE ON public.agent_tools_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
