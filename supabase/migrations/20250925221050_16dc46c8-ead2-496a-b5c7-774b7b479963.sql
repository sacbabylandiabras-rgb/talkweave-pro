-- Criar tabela para configuração de mensagem de boas-vindas
CREATE TABLE public.welcome_message_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL DEFAULT 'Olá! 👋 Bem-vindo à nossa empresa! Como podemos ajudá-lo hoje?',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.welcome_message_config ENABLE ROW LEVEL SECURITY;

-- Criar política para acesso público
CREATE POLICY "Allow public access for welcome_message_config" 
ON public.welcome_message_config 
FOR ALL 
USING (true);

-- Criar tabela para rastrear contatos que já receberam boas-vindas
CREATE TABLE public.welcome_message_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.welcome_message_sent ENABLE ROW LEVEL SECURITY;

-- Criar política para acesso público
CREATE POLICY "Allow public access for welcome_message_sent" 
ON public.welcome_message_sent 
FOR ALL 
USING (true);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_welcome_message_config_updated_at
BEFORE UPDATE ON public.welcome_message_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão
INSERT INTO public.welcome_message_config (active, message) 
VALUES (true, 'Olá! 👋 Bem-vindo à nossa empresa! Como podemos ajudá-lo hoje?');