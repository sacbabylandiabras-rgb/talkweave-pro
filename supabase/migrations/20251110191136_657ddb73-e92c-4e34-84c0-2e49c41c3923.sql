-- Adicionar coluna carousel_cards para suportar templates de carrossel
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS carousel_cards JSONB DEFAULT '[]'::jsonb;