ALTER TABLE gateway_products 
ADD COLUMN IF NOT EXISTS marketplace_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_approve_affiliates BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS buyer_data_access BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage';

COMMENT ON COLUMN gateway_products.marketplace_visible IS 'Indicates if the product is visible in the affiliate marketplace';
COMMENT ON COLUMN gateway_products.auto_approve_affiliates IS 'If true, affiliate requests are automatically approved';
COMMENT ON COLUMN gateway_products.buyer_data_access IS 'If true, affiliates can see buyer email and name';
COMMENT ON COLUMN gateway_products.commission_type IS 'Type of commission: percentage or fixed';
