-- Equipes: dono + funcionários gerenciados

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Minha equipe',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_roles_team ON public.team_roles(team_id);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  role_id uuid REFERENCES public.team_roles(id) ON DELETE SET NULL,
  allowed_instance_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  invited_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);

CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_id uuid REFERENCES public.team_roles(id) ON DELETE SET NULL,
  allowed_instance_ids uuid[] NOT NULL DEFAULT '{}',
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON public.team_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_roles TO authenticated;
GRANT ALL ON public.team_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;

CREATE OR REPLACE FUNCTION public.get_effective_user_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT COALESCE(
    (SELECT t.owner_id FROM public.team_members tm
      JOIN public.teams t ON t.id = tm.team_id
      WHERE tm.user_id = _user_id AND tm.status = 'active'
      LIMIT 1),
    _user_id
  );
$func$;

CREATE OR REPLACE FUNCTION public.is_team_member_of_owner(_owner_id uuid, _caller_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE t.owner_id = _owner_id AND tm.user_id = _caller_id AND tm.status = 'active'
  );
$func$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teams_owner_all ON public.teams;
CREATE POLICY teams_owner_all ON public.teams FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS teams_member_select ON public.teams;
CREATE POLICY teams_member_select ON public.teams FOR SELECT TO authenticated
  USING (public.is_team_member_of_owner(owner_id, auth.uid()));

ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_roles_owner_all ON public.team_roles;
CREATE POLICY team_roles_owner_all ON public.team_roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid()));
DROP POLICY IF EXISTS team_roles_member_select ON public.team_roles;
CREATE POLICY team_roles_member_select ON public.team_roles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.is_team_member_of_owner(t.owner_id, auth.uid())));

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_members_owner_all ON public.team_members;
CREATE POLICY team_members_owner_all ON public.team_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid()));
DROP POLICY IF EXISTS team_members_self_select ON public.team_members;
CREATE POLICY team_members_self_select ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_invites_owner_all ON public.team_invites;
CREATE POLICY team_invites_owner_all ON public.team_invites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid()));

-- Estende RLS em tabelas críticas para permitir funcionários (effective owner)
DO $do$
DECLARE
  t text;
  tables text[] := ARRAY[
    'zapi_instances','saved_contacts','campaigns','message_templates',
    'flow_automations','message_logs','auto_response_config','auto_responses',
    'welcome_message_config','group_welcome_config','pipelines','redirect_links',
    'meta_credentials','agent_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='user_id') THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS team_member_access ON public.%I; '
        'CREATE POLICY team_member_access ON public.%I FOR ALL TO authenticated '
        'USING (user_id = public.get_effective_user_id(auth.uid())) '
        'WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));',
        t, t
      );
    END IF;
  END LOOP;
END $do$;
CREATE TABLE IF NOT EXISTS public.affiliate_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  account_id text,
  account_nickname text,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expires_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_connections TO authenticated;
GRANT ALL ON public.affiliate_connections TO service_role;

ALTER TABLE public.affiliate_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own affiliate connections"
  ON public.affiliate_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own affiliate connections"
  ON public.affiliate_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_connections_user_provider
  ON public.affiliate_connections (user_id, provider);

CREATE TABLE IF NOT EXISTS public.affiliate_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  redirect_uri text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.affiliate_oauth_states TO service_role;
ALTER TABLE public.affiliate_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.ml_affiliate_link_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_id text NOT NULL,
  original_url text NOT NULL,
  short_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_id, original_url)
);

CREATE INDEX IF NOT EXISTS idx_ml_aff_cache_lookup
  ON public.ml_affiliate_link_cache (user_id, source_id, original_url);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_affiliate_link_cache TO authenticated;
GRANT ALL ON public.ml_affiliate_link_cache TO service_role;

ALTER TABLE public.ml_affiliate_link_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own ml link cache"
  ON public.ml_affiliate_link_cache FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users insert own ml link cache"
  ON public.ml_affiliate_link_cache FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own ml link cache"
  ON public.ml_affiliate_link_cache FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
