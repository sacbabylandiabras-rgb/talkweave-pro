-- Security fixes for findings in the security scan

-- 1. profiles: restrict SELECT to owner; admins have separate policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2-5. Warmup tables: only admins can read
DROP POLICY IF EXISTS "Authenticated can read active warmup messages" ON public.warmup_messages;
DROP POLICY IF EXISTS "Authenticated read active warmup_group_links" ON public.warmup_group_links;
DROP POLICY IF EXISTS "Authenticated can read active warmup donors" ON public.warmup_donor_numbers;
DROP POLICY IF EXISTS "warmup_instance_health read all auth" ON public.warmup_instance_health;

-- 6. hidden_dispatch_instances: only admins can read
DROP POLICY IF EXISTS "Authenticated can list hidden dispatch" ON public.hidden_dispatch_instances;

-- 7. link_clicks: remove anonymous INSERT (edge functions use service role)
DROP POLICY IF EXISTS "Service role can insert link clicks" ON public.link_clicks;

-- 8. gateway_platform_config: restrict reads to authenticated users
DROP POLICY IF EXISTS "Anyone can read platform config" ON public.gateway_platform_config;
CREATE POLICY "Authenticated can read platform config"
  ON public.gateway_platform_config FOR SELECT TO authenticated
  USING (true);

-- 9. Storage: product-images path ownership
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can upload own product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 10. Storage: template-media path ownership
DROP POLICY IF EXISTS "Authenticated users can upload template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete template-media" ON storage.objects;
CREATE POLICY "Users can upload own template-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own template-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own template-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 11. Storage: flow-media path ownership
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar" ON storage.objects;
CREATE POLICY "Users can upload own flow-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own flow-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own flow-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);
