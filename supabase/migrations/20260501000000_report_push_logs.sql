CREATE TABLE IF NOT EXISTS public.report_push_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slot_key text NOT NULL,
  messages_sent integer NOT NULL DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  sales_amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_report_push_logs_slot ON public.report_push_logs (slot_key);

ALTER TABLE public.report_push_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access report_push_logs"
  ON public.report_push_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own report_push_logs"
  ON public.report_push_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
