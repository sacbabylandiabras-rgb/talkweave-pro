-- Add agent_stage column to saved_contacts if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_contacts' AND column_name = 'agent_stage') THEN
    ALTER TABLE public.saved_contacts ADD COLUMN agent_stage text DEFAULT 'triage';
  END IF;
END $$;
