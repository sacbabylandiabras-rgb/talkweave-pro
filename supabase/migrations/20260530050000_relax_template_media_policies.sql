DROP POLICY IF EXISTS "template_media_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "template_media_update_own" ON storage.objects;
DROP POLICY IF EXISTS "template_media_delete_own" ON storage.objects;

CREATE POLICY "template_media_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'template-media');

CREATE POLICY "template_media_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'template-media')
WITH CHECK (bucket_id = 'template-media');

CREATE POLICY "template_media_delete_authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'template-media');
