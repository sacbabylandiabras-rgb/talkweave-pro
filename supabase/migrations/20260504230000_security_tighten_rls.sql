-- Profiles: restrict SELECT to owner or admin
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role));

-- hidden_dispatch_instances: restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated can list hidden dispatch" ON public.hidden_dispatch_instances;

-- warmup_donor_numbers: restrict SELECT to admins
DROP POLICY IF EXISTS "Authenticated can read active warmup donors" ON public.warmup_donor_numbers;

-- warmup_instance_health: restrict SELECT to admins
DROP POLICY IF EXISTS "warmup_instance_health read all auth" ON public.warmup_instance_health;

-- Storage: product-images ownership scoping (path: <uid>/...)
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
CREATE POLICY "Users can update own product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage: template-media ownership scoping
DROP POLICY IF EXISTS "Authenticated users can delete template-media" ON storage.objects;
CREATE POLICY "Users can delete own template-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'template-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users can update template-media" ON storage.objects;
CREATE POLICY "Users can update own template-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'template-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users can upload template-media" ON storage.objects;
CREATE POLICY "Users can upload own template-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'template-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
