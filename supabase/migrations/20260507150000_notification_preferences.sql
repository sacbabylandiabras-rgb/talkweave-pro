CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  checkout_id uuid NULL,
  enabled boolean NOT NULL DEFAULT true,
  notify_credit_card boolean NOT NULL DEFAULT true,
  notify_boleto_paid boolean NOT NULL DEFAULT true,
  notify_pix_paid boolean NOT NULL DEFAULT true,
  notify_pix_recurring boolean NOT NULL DEFAULT true,
  notify_apple_pay boolean NOT NULL DEFAULT true,
  notify_pix_or_boleto_issued boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_default_uniq
  ON public.notification_preferences (user_id)
  WHERE checkout_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_checkout_uniq
  ON public.notification_preferences (user_id, checkout_id)
  WHERE checkout_id IS NOT NULL;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification_preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification_preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification_preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification_preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification_preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification_preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notification_preferences" ON public.notification_preferences;
CREATE POLICY "Users can delete own notification_preferences"
  ON public.notification_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access notification_preferences" ON public.notification_preferences;
CREATE POLICY "Service role full access notification_preferences"
  ON public.notification_preferences FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
