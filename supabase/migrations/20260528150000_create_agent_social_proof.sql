CREATE TABLE IF NOT EXISTS public.agent_social_proof (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  caption text,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_social_proof TO authenticated;
GRANT ALL ON public.agent_social_proof TO service_role;
ALTER TABLE public.agent_social_proof ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_social_proof_select_own" ON public.agent_social_proof FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agent_social_proof_insert_own" ON public.agent_social_proof FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_social_proof_update_own" ON public.agent_social_proof FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_social_proof_delete_own" ON public.agent_social_proof FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_agent_social_proof_user ON public.agent_social_proof(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_social_proof_active ON public.agent_social_proof(user_id, active);

INSERT INTO storage.buckets (id, name, public) VALUES ('agent-social-proof', 'agent-social-proof', true) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  CREATE POLICY "agent_social_proof_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'agent-social-proof');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_social_proof_obj_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'agent-social-proof' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_social_proof_obj_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'agent-social-proof' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_social_proof_obj_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'agent-social-proof' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
