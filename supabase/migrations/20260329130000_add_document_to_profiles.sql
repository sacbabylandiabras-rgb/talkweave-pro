ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'cpf';
