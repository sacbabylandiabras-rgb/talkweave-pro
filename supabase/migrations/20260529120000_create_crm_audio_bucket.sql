-- Bucket público para áudios gerados pelo TTS do agente IA
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-audio', 'crm-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'crm-audio public read'
  ) THEN
    CREATE POLICY "crm-audio public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'crm-audio');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'crm-audio service write'
  ) THEN
    CREATE POLICY "crm-audio service write"
      ON storage.objects FOR INSERT
      TO service_role
      WITH CHECK (bucket_id = 'crm-audio');
  END IF;
END $$;
