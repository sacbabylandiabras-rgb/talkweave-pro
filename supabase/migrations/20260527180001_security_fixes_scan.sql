-- Security fixes for scanner findings

-- 1) profiles: restrict SELECT to owner + admins
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper RPCs so pipeline UI can still show member name/email
CREATE OR REPLACE FUNCTION public.get_pipeline_member_profiles(_pipeline_id uuid)
RETURNS TABLE(id uuid, email text, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.email, p.full_name
  FROM public.profiles p
  WHERE p.id IN (
    SELECT pm.user_id FROM public.pipeline_members pm WHERE pm.pipeline_id = _pipeline_id
  )
  AND (
    public.is_pipeline_owner(_pipeline_id, auth.uid())
    OR public.is_pipeline_member(_pipeline_id, auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_pipeline_member_profiles(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.find_profile_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_profile_id_by_email(text) TO authenticated;

-- 2) gateway_platform_config: require authentication for reads
DROP POLICY IF EXISTS "Anyone can read platform config" ON public.gateway_platform_config;
CREATE POLICY "Authenticated can read platform config"
  ON public.gateway_platform_config FOR SELECT TO authenticated
  USING (true);

-- 3) hidden_dispatch_instances: remove broad authenticated SELECT
DROP POLICY IF EXISTS "Authenticated can list hidden dispatch" ON public.hidden_dispatch_instances;

-- 4) redirect_link_clicks: remove permissive anon/authenticated INSERT (service role bypasses RLS)
DROP POLICY IF EXISTS "Service role can insert clicks" ON public.redirect_link_clicks;

-- 5) warmup_group_links: remove broad authenticated SELECT
DROP POLICY IF EXISTS "Authenticated read active warmup_group_links" ON public.warmup_group_links;

-- 6) Storage: enforce path ownership on write policies
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar" ON storage.objects;
CREATE POLICY "flow_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "flow_media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "flow_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "product_images_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "product_images_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "product_images_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users can upload template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete template-media" ON storage.objects;
CREATE POLICY "template_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "template_media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "template_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);
