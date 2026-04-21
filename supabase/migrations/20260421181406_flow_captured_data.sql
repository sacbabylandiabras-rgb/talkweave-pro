-- Tabela para armazenar dados capturados em fluxos
CREATE TABLE IF NOT EXISTS public.flow_captured_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id uuid,
  flow_name text,
  phone text NOT NULL,
  nome text,
  whatsapp text,
  email text,
  source text DEFAULT 'whatsapp',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_captured_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flow_captured_data"
  ON public.flow_captured_data FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flow_captured_data"
  ON public.flow_captured_data FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access flow_captured_data"
  ON public.flow_captured_data FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete own flow_captured_data"
  ON public.flow_captured_data FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_flow_captured_data_user_id ON public.flow_captured_data(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_captured_data_flow_id ON public.flow_captured_data(flow_id);
