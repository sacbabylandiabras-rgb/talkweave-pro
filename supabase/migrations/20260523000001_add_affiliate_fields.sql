-- Add affiliate fields to gateway_products
ALTER TABLE gateway_products ADD COLUMN IF NOT EXISTS affiliate_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE gateway_products ADD COLUMN IF NOT EXISTS commission_rate INTEGER DEFAULT 0;
