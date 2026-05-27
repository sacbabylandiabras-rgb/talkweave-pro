CREATE TABLE IF NOT EXISTS public.agent_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_products TO authenticated;
GRANT ALL ON public.agent_products TO service_role;
ALTER TABLE public.agent_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_products_select_own" ON public.agent_products;
CREATE POLICY "agent_products_select_own" ON public.agent_products FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "agent_products_insert_own" ON public.agent_products;
CREATE POLICY "agent_products_insert_own" ON public.agent_products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "agent_products_update_own" ON public.agent_products;
CREATE POLICY "agent_products_update_own" ON public.agent_products FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "agent_products_delete_own" ON public.agent_products;
CREATE POLICY "agent_products_delete_own" ON public.agent_products FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_agent_products_user ON public.agent_products(user_id, created_at DESC);
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-products', 'agent-products', true) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  CREATE POLICY "agent_products_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'agent-products');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_products_images_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'agent-products' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_products_images_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'agent-products' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "agent_products_images_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'agent-products' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
