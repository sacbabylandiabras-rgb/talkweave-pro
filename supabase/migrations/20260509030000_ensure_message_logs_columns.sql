DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_logs' AND column_name = 'sender_name') THEN
        ALTER TABLE public.message_logs ADD COLUMN sender_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_logs' AND column_name = 'sender_phone') THEN
        ALTER TABLE public.message_logs ADD COLUMN sender_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_logs' AND column_name = 'sender_photo') THEN
        ALTER TABLE public.message_logs ADD COLUMN sender_photo TEXT;
    END IF;
END $$;

ALTER TABLE public.message_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_logs') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.message_logs;
  END IF;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_logs;
END $$;
