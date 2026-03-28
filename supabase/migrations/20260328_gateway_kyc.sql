CREATE TABLE IF NOT EXISTS public.gateway_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  selfie_url text,
  doc_front_url text,
  doc_back_url text,
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.gateway_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own kyc" ON public.gateway_kyc FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own kyc" ON public.gateway_kyc FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own kyc" ON public.gateway_kyc FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all kyc" ON public.gateway_kyc FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update any kyc" ON public.gateway_kyc FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_gateway_kyc_updated_at BEFORE UPDATE ON public.gateway_kyc FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own kyc docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own kyc docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins can view all kyc docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));
