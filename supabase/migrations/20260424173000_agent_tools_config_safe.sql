CREATE TABLE IF NOT EXISTS public.agent_tools_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_name)
);

ALTER TABLE public.agent_tools_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_tools_config' AND policyname = 'users select own agent tools'
  ) THEN
    CREATE POLICY "users select own agent tools" ON public.agent_tools_config
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_tools_config' AND policyname = 'users insert own agent tools'
  ) THEN
    CREATE POLICY "users insert own agent tools" ON public.agent_tools_config
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_tools_config' AND policyname = 'users update own agent tools'
  ) THEN
    CREATE POLICY "users update own agent tools" ON public.agent_tools_config
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_tools_config' AND policyname = 'users delete own agent tools'
  ) THEN
    CREATE POLICY "users delete own agent tools" ON public.agent_tools_config
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS agent_tools_config_updated_at ON public.agent_tools_config;
CREATE TRIGGER agent_tools_config_updated_at
  BEFORE UPDATE ON public.agent_tools_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
