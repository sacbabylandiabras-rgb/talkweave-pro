-- Create table for email domain verification status
CREATE TABLE IF NOT EXISTS public.email_domain_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL,
  resend_domain_id text,
  status text NOT NULL DEFAULT 'pending',
  dkim_records jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, domain)
);

-- Enable RLS
ALTER TABLE public.email_domain_verifications ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own domain verifications') THEN
        CREATE POLICY "Users can view their own domain verifications" ON public.email_domain_verifications FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own domain verifications') THEN
        CREATE POLICY "Users can insert their own domain verifications" ON public.email_domain_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own domain verifications') THEN
        CREATE POLICY "Users can update their own domain verifications" ON public.email_domain_verifications FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own domain verifications') THEN
        CREATE POLICY "Users can delete their own domain verifications" ON public.email_domain_verifications FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Grant access to service role for edge functions
GRANT ALL ON public.email_domain_verifications TO service_role;
GRANT ALL ON public.email_domain_verifications TO authenticated;
