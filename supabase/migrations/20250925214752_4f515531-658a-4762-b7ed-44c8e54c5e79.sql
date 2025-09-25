-- Criar tabela de configuração do sistema de resposta automática
CREATE TABLE public.auto_response_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de respostas automáticas
CREATE TABLE public.auto_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  response TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de logs de mensagens
CREATE TABLE public.message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  message_received TEXT,
  keyword_matched TEXT,
  response_sent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.auto_response_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir acesso público (sistema de bot)
CREATE POLICY "Allow public access for auto_response_config" 
ON public.auto_response_config 
FOR ALL 
USING (true);

CREATE POLICY "Allow public access for auto_responses" 
ON public.auto_responses 
FOR ALL 
USING (true);

CREATE POLICY "Allow public access for message_logs" 
ON public.message_logs 
FOR ALL 
USING (true);

-- Inserir configuração inicial
INSERT INTO public.auto_response_config (active, webhook_url) 
VALUES (false, 'https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/webhook-zapi');

-- Inserir algumas respostas automáticas padrão
INSERT INTO public.auto_responses (keyword, response, active) VALUES
('horário', 'Nosso horário de funcionamento é de segunda a sexta, das 8h às 18h.', true),
('preço', 'Para informações sobre preços, entre em contato com nossa equipe comercial.', true),
('localização', 'Estamos localizados na Rua das Flores, 123 - Centro, São Paulo - SP', false);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_auto_response_config_updated_at
  BEFORE UPDATE ON public.auto_response_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_auto_responses_updated_at
  BEFORE UPDATE ON public.auto_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();