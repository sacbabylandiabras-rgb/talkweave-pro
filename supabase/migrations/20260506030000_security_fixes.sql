-- Tighten profiles SELECT to owner or admin only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Restrict sensitive tables to admin-only SELECT
DROP POLICY IF EXISTS "Authenticated can list hidden dispatch" ON public.hidden_dispatch_instances;
DROP POLICY IF EXISTS "Authenticated can read active warmup donors" ON public.warmup_donor_numbers;
DROP POLICY IF EXISTS "warmup_instance_health read all auth" ON public.warmup_instance_health;

-- Storage: template-media ownership enforcement
DROP POLICY IF EXISTS "Authenticated users can delete template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload template-media" ON storage.objects;

CREATE POLICY "Users can upload own template-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own template-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own template-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage: flow-media ownership enforcement
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;

CREATE POLICY "Users can upload own flow-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own flow-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own flow-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage: product-images ownership enforcement
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;

CREATE POLICY "Users can upload own product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
