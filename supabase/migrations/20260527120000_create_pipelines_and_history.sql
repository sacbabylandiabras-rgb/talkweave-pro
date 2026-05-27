-- Pipelines: own table + members for sharing + stage history for metrics
-- Also adds missing columns to saved_contacts used by chat/pipeline UI.

-- saved_contacts: add missing columns
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS agent_stage text;
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS deal_value numeric DEFAULT 0;
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS closing_date timestamptz;
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS responsible_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS deal_metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS pipeline_id text;
CREATE UNIQUE INDEX IF NOT EXISTS saved_contacts_phone_user_uidx ON public.saved_contacts (phone, user_id);

-- pipelines
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  department text,
  currency text NOT NULL DEFAULT 'BRL',
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipelines TO authenticated;
GRANT ALL ON public.pipelines TO service_role;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

-- pipeline_members
CREATE TABLE IF NOT EXISTS public.pipeline_members (
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('viewer','editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pipeline_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_members TO authenticated;
GRANT ALL ON public.pipeline_members TO service_role;
ALTER TABLE public.pipeline_members ENABLE ROW LEVEL SECURITY;

-- security definer helpers to avoid recursion
CREATE OR REPLACE FUNCTION public.is_pipeline_owner(_pipeline_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pipelines WHERE id = _pipeline_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_pipeline_member(_pipeline_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pipeline_members WHERE pipeline_id = _pipeline_id AND user_id = _user_id);
$$;

-- pipelines RLS
CREATE POLICY "owners full access to own pipelines"
  ON public.pipelines FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "members can read shared pipelines"
  ON public.pipelines FOR SELECT TO authenticated
  USING (public.is_pipeline_member(id, auth.uid()));

CREATE POLICY "editor members can update shared pipelines"
  ON public.pipelines FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pipeline_members
    WHERE pipeline_id = pipelines.id AND user_id = auth.uid() AND role = 'editor'
  ));

-- pipeline_members RLS
CREATE POLICY "owners manage members"
  ON public.pipeline_members FOR ALL TO authenticated
  USING (public.is_pipeline_owner(pipeline_id, auth.uid()))
  WITH CHECK (public.is_pipeline_owner(pipeline_id, auth.uid()));

CREATE POLICY "users see their memberships"
  ON public.pipeline_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- pipeline_stage_history (for metrics)
CREATE TABLE IF NOT EXISTS public.pipeline_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pipeline_id text,
  contact_phone text NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  moved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pipeline_stage_history TO authenticated;
GRANT ALL ON public.pipeline_stage_history TO service_role;
ALTER TABLE public.pipeline_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own history"
  ON public.pipeline_stage_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own history"
  ON public.pipeline_stage_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS pipeline_stage_history_user_pipe_idx
  ON public.pipeline_stage_history (user_id, pipeline_id, moved_at DESC);

-- updated_at trigger on pipelines
DROP TRIGGER IF EXISTS pipelines_set_updated_at ON public.pipelines;
CREATE TRIGGER pipelines_set_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
