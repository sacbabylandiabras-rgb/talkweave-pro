CREATE TABLE IF NOT EXISTS public.email_domain_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL,
  resend_domain_id text,
  status text,
  dkim_records jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_domain_verifications TO authenticated;
GRANT ALL ON public.email_domain_verifications TO service_role;

ALTER TABLE public.email_domain_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email domain verifications"
ON public.email_domain_verifications
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS email_domain_verifications_user_id_idx
  ON public.email_domain_verifications(user_id);
