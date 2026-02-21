
-- Table for storing webhook gateway integrations
CREATE TABLE public.gateway_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB DEFAULT '{}'::jsonb,
  auth_type TEXT DEFAULT 'none',
  auth_token TEXT DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_tested_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  last_test_status TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gateway_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own gateway_integrations"
ON public.gateway_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gateway_integrations"
ON public.gateway_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gateway_integrations"
ON public.gateway_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gateway_integrations"
ON public.gateway_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_gateway_integrations_updated_at
BEFORE UPDATE ON public.gateway_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
