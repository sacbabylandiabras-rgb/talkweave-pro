-- Criar bucket para templates de mensagem
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-media',
  'template-media',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/quicktime', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- Permitir que todos vejam os arquivos (bucket público)
CREATE POLICY "Public Access for template-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'template-media');

-- Permitir upload de arquivos para usuários autenticados
CREATE POLICY "Authenticated users can upload template-media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'template-media' 
  AND auth.role() = 'authenticated'
);

-- Permitir que usuários autenticados atualizem seus arquivos
CREATE POLICY "Authenticated users can update template-media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'template-media' 
  AND auth.role() = 'authenticated'
);

-- Permitir que usuários autenticados deletem arquivos
CREATE POLICY "Authenticated users can delete template-media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'template-media' 
  AND auth.role() = 'authenticated'
);