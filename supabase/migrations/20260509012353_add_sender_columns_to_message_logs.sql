-- Migration to add sender_name and sender_phone to message_logs
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS sender_phone TEXT;

-- Update RLS if needed (usually columns are covered by existing policies)
-- The existing policies are based on user_id, which still works.
