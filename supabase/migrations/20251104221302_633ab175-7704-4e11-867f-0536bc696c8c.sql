-- Criar bucket para mídia dos fluxos
INSERT INTO storage.buckets (id, name, public)
VALUES ('flow-media', 'flow-media', true);

-- Permitir usuários autenticados fazerem upload
CREATE POLICY "Usuários autenticados podem fazer upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'flow-media');

-- Permitir usuários autenticados atualizarem seus arquivos
CREATE POLICY "Usuários autenticados podem atualizar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'flow-media');

-- Permitir todos verem os arquivos (bucket público)
CREATE POLICY "Todos podem visualizar arquivos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'flow-media');

-- Permitir usuários autenticados deletarem arquivos
CREATE POLICY "Usuários autenticados podem deletar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'flow-media');