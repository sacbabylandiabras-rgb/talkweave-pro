CREATE TABLE IF NOT EXISTS public.warmup_group_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_url text NOT NULL,
  label text,
  threshold integer NOT NULL DEFAULT 100,
  group_jid text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_group_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage warmup_group_links" ON public.warmup_group_links;
CREATE POLICY "Admins manage warmup_group_links"
  ON public.warmup_group_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read active warmup_group_links" ON public.warmup_group_links;
CREATE POLICY "Authenticated can read active warmup_group_links"
  ON public.warmup_group_links FOR SELECT TO authenticated
  USING (active = true);

CREATE TABLE IF NOT EXISTS public.warmup_group_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  link_id uuid NOT NULL REFERENCES public.warmup_group_links(id) ON DELETE CASCADE,
  user_id uuid,
  joined_at_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, link_id)
);

ALTER TABLE public.warmup_group_joins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage warmup_group_joins" ON public.warmup_group_joins;
CREATE POLICY "Admins manage warmup_group_joins"
  ON public.warmup_group_joins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own warmup_group_joins" ON public.warmup_group_joins;
CREATE POLICY "Users can view own warmup_group_joins"
  ON public.warmup_group_joins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_warmup_group_joins_instance ON public.warmup_group_joins(instance_id);
