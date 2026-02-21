
-- Tabela para configurar funil de mensagens por evento do gateway
CREATE TABLE public.gateway_funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- ex: 'payment_pending', 'payment_approved', 'payment_refused'
  event_label TEXT NOT NULL, -- ex: 'Pagamento Pendente'
  message_template TEXT NOT NULL, -- mensagem com variáveis {{nome}}, {{valor}}, {{produto}}
  active BOOLEAN NOT NULL DEFAULT true,
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gateway_funnels" ON public.gateway_funnels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own gateway_funnels" ON public.gateway_funnels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gateway_funnels" ON public.gateway_funnels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gateway_funnels" ON public.gateway_funnels FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_gateway_funnels_updated_at
  BEFORE UPDATE ON public.gateway_funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para log de webhooks recebidos
CREATE TABLE public.gateway_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT,
  phone TEXT,
  payload JSONB,
  message_sent TEXT,
  status TEXT DEFAULT 'received',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gateway_webhook_logs" ON public.gateway_webhook_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own gateway_webhook_logs" ON public.gateway_webhook_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
