ALTER TABLE public.gateway_kyc
ADD COLUMN IF NOT EXISTS whatsapp text,
ADD COLUMN IF NOT EXISTS business_data jsonb DEFAULT '{}'::jsonb;
