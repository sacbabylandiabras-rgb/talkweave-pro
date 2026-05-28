CREATE TABLE IF NOT EXISTS public.agent_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  caption text,
  media_url text,
  media_type text NOT NULL DEFAULT 'text',
  content_text text,
  product_id text,
  order_index int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_deliverables TO authenticated;
GRANT ALL ON public.agent_deliverables TO service_role;
ALTER TABLE public.agent_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_deliverables_select_own" ON public.agent_deliverables FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agent_deliverables_insert_own" ON public.agent_deliverables FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_deliverables_update_own" ON public.agent_deliverables FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_deliverables_delete_own" ON public.agent_deliverables FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_agent_deliverables_user ON public.agent_deliverables(user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_agent_deliverables_active ON public.agent_deliverables(user_id, active);

INSERT INTO storage.buckets (id, name, public) VALUES ('agent-deliverables', 'agent-deliverables', true) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  CREATE POLICY "agent_deliverables_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'agent-deliverables');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_deliverables_obj_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'agent-deliverables' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_deliverables_obj_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'agent-deliverables' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_deliverables_obj_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'agent-deliverables' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
