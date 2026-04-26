-- Subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0, -- in cents
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Anyone can read plans"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can insert plans"
  ON public.subscription_plans FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update plans"
  ON public.subscription_plans FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete plans"
  ON public.subscription_plans FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add plan_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

-- Seed default plans
INSERT INTO public.subscription_plans (name, price, description) VALUES
  ('Básico', 4700, 'Plano básico'),
  ('Pro', 9700, 'Plano profissional'),
  ('Enterprise', 19700, 'Plano empresarial')
ON CONFLICT DO NOTHING;
