-- Create gateway_withdrawals table
CREATE TABLE public.gateway_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  pix_key_type text NOT NULL DEFAULT 'cpf',
  pix_key text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own withdrawals" ON public.gateway_withdrawals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own withdrawals" ON public.gateway_withdrawals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawals" ON public.gateway_withdrawals
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any withdrawal" ON public.gateway_withdrawals
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_gateway_withdrawals_updated_at
  BEFORE UPDATE ON public.gateway_withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
