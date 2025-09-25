-- Criar tabela de modelos de mensagem
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  usage_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de campanhas
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.message_templates(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  target_audience JSONB DEFAULT '{}'::jsonb,
  schedule_type TEXT DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled', 'recurring')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  recurrence_pattern TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de envios de campanha
CREATE TABLE public.campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  contact_name TEXT,
  message_content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS (acesso público por enquanto)
CREATE POLICY "Allow public access for message_templates" 
ON public.message_templates FOR ALL USING (true);

CREATE POLICY "Allow public access for campaigns" 
ON public.campaigns FOR ALL USING (true);

CREATE POLICY "Allow public access for campaign_sends" 
ON public.campaign_sends FOR ALL USING (true);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir modelos padrão
INSERT INTO public.message_templates (name, category, content, variables) VALUES
('Saudação Comercial', 'Saudação', 'Olá {nome}! Obrigado por entrar em contato conosco. Como podemos ajudá-lo hoje?', '["nome"]'),
('Informações de Produto', 'Vendas', 'Olá {nome}! Nosso produto {produto} oferece funcionalidades incríveis. Gostaria de saber mais detalhes?', '["nome", "produto"]'),
('Agendamento', 'Atendimento', 'Olá {nome}! Para agendar uma reunião, por favor nos informe sua disponibilidade. Nossos horários são de segunda a sexta, das 9h às 17h.', '["nome"]'),
('Suporte Técnico', 'Suporte', 'Olá {nome}! Recebemos sua solicitação de suporte. Nossa equipe técnica entrará em contato em até 24 horas.', '["nome"]'),
('Promoção Especial', 'Marketing', 'Olá {nome}! Temos uma oferta especial para você: {promocao}. Válida até {data}. Não perca!', '["nome", "promocao", "data"]');