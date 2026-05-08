-- Security fixes from scanner findings

-- 1. profiles: restrict SELECT to owner or admin
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or admin"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2. warmup_donor_numbers
DROP POLICY IF EXISTS "Authenticated can read active warmup donors" ON public.warmup_donor_numbers;

-- 3. warmup_instance_health
DROP POLICY IF EXISTS "warmup_instance_health read all auth" ON public.warmup_instance_health;

-- 4. hidden_dispatch_instances
DROP POLICY IF EXISTS "Authenticated can list hidden dispatch" ON public.hidden_dispatch_instances;

-- 5. warmup_group_links
DROP POLICY IF EXISTS "Authenticated read active warmup_group_links" ON public.warmup_group_links;

-- 6. link_clicks: restrict insert to authenticated user inserting own row
DROP POLICY IF EXISTS "Service role can insert link clicks" ON public.link_clicks;
CREATE POLICY "Users can insert own link clicks"
ON public.link_clicks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 7. Storage path-ownership enforcement
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;

CREATE POLICY "Users can upload own product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- flow-media
DROP POLICY IF EXISTS "Users can upload flow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update flow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete flow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload flow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update flow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete flow media" ON storage.objects;

CREATE POLICY "Users can upload own flow media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own flow media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own flow media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'flow-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- template-media
DROP POLICY IF EXISTS "Authenticated users can upload template media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update template media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete template media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload template media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update template media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete template media" ON storage.objects;

CREATE POLICY "Users can upload own template media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own template media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own template media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'template-media' AND (storage.foldername(name))[1] = auth.uid()::text);
