CREATE TABLE IF NOT EXISTS public.agent_handoff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  reason text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_handoff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own handoff" ON public.agent_handoff
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own handoff" ON public.agent_handoff
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own handoff" ON public.agent_handoff
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS agent_handoff_user_phone_idx ON public.agent_handoff (user_id, phone);
