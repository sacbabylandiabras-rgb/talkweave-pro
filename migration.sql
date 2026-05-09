ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS sender_phone TEXT;
