CREATE TABLE IF NOT EXISTS public.resend_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  email_id text,
  recipient text,
  sender text,
  subject text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.resend_webhook_events TO authenticated;
GRANT ALL ON public.resend_webhook_events TO service_role;

ALTER TABLE public.resend_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read resend events"
ON public.resend_webhook_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_resend_webhook_events_email_id ON public.resend_webhook_events(email_id);
CREATE INDEX IF NOT EXISTS idx_resend_webhook_events_type ON public.resend_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_resend_webhook_events_created_at ON public.resend_webhook_events(created_at DESC);
