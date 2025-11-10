-- Adicionar campos para suportar diferentes tipos de templates
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS file_name text,
ADD COLUMN IF NOT EXISTS file_type text,
ADD COLUMN IF NOT EXISTS list_items jsonb DEFAULT '[]'::jsonb;

-- Adicionar comentários explicativos
COMMENT ON COLUMN message_templates.media_url IS 'URL da mídia para templates de imagem, áudio, vídeo, etc';
COMMENT ON COLUMN message_templates.file_name IS 'Nome do arquivo para templates de documento/arquivo';
COMMENT ON COLUMN message_templates.file_type IS 'Tipo de arquivo (pdf, doc, etc)';
COMMENT ON COLUMN message_templates.list_items IS 'Itens da lista para templates do tipo lista_opcao';