CREATE TABLE IF NOT EXISTS public.warmup_donor_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  label TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT warmup_donor_numbers_phone_unique UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS idx_warmup_donor_numbers_active
  ON public.warmup_donor_numbers(active);

ALTER TABLE public.warmup_donor_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage warmup donors" ON public.warmup_donor_numbers;
CREATE POLICY "Admins manage warmup donors"
  ON public.warmup_donor_numbers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated can read active warmup donors" ON public.warmup_donor_numbers;
CREATE POLICY "Authenticated can read active warmup donors"
  ON public.warmup_donor_numbers
  FOR SELECT
  TO authenticated
  USING (active = true);

DROP TRIGGER IF EXISTS warmup_donor_numbers_updated_at ON public.warmup_donor_numbers;
CREATE TRIGGER warmup_donor_numbers_updated_at
  BEFORE UPDATE ON public.warmup_donor_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE IF NOT EXISTS public.warmup_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT warmup_messages_content_unique UNIQUE (content)
);

CREATE INDEX IF NOT EXISTS idx_warmup_messages_active ON public.warmup_messages(active);

ALTER TABLE public.warmup_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage warmup messages" ON public.warmup_messages;
CREATE POLICY "Admins manage warmup messages"
  ON public.warmup_messages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated can read active warmup messages" ON public.warmup_messages;
CREATE POLICY "Authenticated can read active warmup messages"
  ON public.warmup_messages
  FOR SELECT
  TO authenticated
  USING (active = true);

DROP TRIGGER IF EXISTS warmup_messages_updated_at ON public.warmup_messages;
CREATE TRIGGER warmup_messages_updated_at
  BEFORE UPDATE ON public.warmup_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
