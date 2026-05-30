ALTER TABLE public.sent_emails_mapping
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS html text,
  ADD COLUMN IF NOT EXISTS recipient text;

GRANT SELECT ON public.sent_emails_mapping TO authenticated;
GRANT ALL ON public.sent_emails_mapping TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sent_emails_mapping'
      AND policyname = 'Users read own sent emails'
  ) THEN
    CREATE POLICY "Users read own sent emails"
      ON public.sent_emails_mapping
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
