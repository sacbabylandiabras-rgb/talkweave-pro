-- Ensure columns exist
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS sender_photo TEXT;

-- Set replica identity to FULL
ALTER TABLE public.message_logs REPLICA IDENTITY FULL;

-- Refresh publication to include new columns
-- First check if it exists in publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_logs') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.message_logs;
  END IF;
  
  -- Add it back (this will include all current columns)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_logs;
END $$;
