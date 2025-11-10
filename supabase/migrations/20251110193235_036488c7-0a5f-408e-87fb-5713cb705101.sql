-- Adicionar 'cancelled' aos status permitidos na tabela campaigns
ALTER TABLE campaigns 
DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text]));