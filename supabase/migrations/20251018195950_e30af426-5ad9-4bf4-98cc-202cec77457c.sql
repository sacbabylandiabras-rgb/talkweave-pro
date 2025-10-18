
-- Adicionar campos de assinatura e pagamento à tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'pending' CHECK (subscription_status IN ('active', 'pending', 'expired', 'cancelled')),
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS zapi_instance_id text,
ADD COLUMN IF NOT EXISTS zapi_token text,
ADD COLUMN IF NOT EXISTS zapi_client_token text;

-- Criar comentários para documentar os campos
COMMENT ON COLUMN public.profiles.subscription_status IS 'Status da assinatura: active (pago), pending (pendente), expired (expirado), cancelled (cancelado)';
COMMENT ON COLUMN public.profiles.subscription_expires_at IS 'Data de expiração da assinatura';
COMMENT ON COLUMN public.profiles.zapi_instance_id IS 'ID da instância Z-API do usuário';
COMMENT ON COLUMN public.profiles.zapi_token IS 'Token da API Z-API do usuário';
COMMENT ON COLUMN public.profiles.zapi_client_token IS 'Client token da Z-API do usuário';
