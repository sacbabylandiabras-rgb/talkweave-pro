-- Subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plans" ON public.subscription_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert plans" ON public.subscription_plans FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update plans" ON public.subscription_plans FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete plans" ON public.subscription_plans FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

INSERT INTO public.subscription_plans (name, price, description) VALUES
  ('Plano Start', 10000, 'Mensagens ilimitadas, 1 instância, suporte básico'),
  ('Plano Pro', 34900, 'Mensagens ilimitadas, 5 instâncias, suporte prioritário'),
  ('Plano Scale', 89700, 'Mensagens ilimitadas, 10 instâncias, suporte VIP')
ON CONFLICT DO NOTHING;
