-- Adicionar coluna type na tabela message_templates
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'texto';

-- Adicionar comentário explicativo
COMMENT ON COLUMN message_templates.type IS 'Tipo de template: texto, imagem, audio, video, lista_opcao, copia_cola, arquivo, imagem_botoes, documento, carrossel';