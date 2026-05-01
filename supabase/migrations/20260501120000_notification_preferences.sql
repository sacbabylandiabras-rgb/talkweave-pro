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
  notify_pix_or_boleto_issued boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkout_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences(user_id);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification preferences" ON public.notification_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_notification_preferences_updated BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
