CREATE TABLE IF NOT EXISTS public.user_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_email_templates TO authenticated;
GRANT ALL ON public.user_email_templates TO service_role;

ALTER TABLE public.user_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own email templates"
ON public.user_email_templates FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_email_templates_user ON public.user_email_templates(user_id, created_at DESC);

CREATE TRIGGER trg_user_email_templates_updated_at
BEFORE UPDATE ON public.user_email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
