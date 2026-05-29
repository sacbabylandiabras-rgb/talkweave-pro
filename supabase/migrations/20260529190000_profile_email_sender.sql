ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_sender_name TEXT,
  ADD COLUMN IF NOT EXISTS email_sender_address TEXT;
