ALTER TABLE public.agent_config
  ADD COLUMN IF NOT EXISTS voice_provider text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS elevenlabs_api_key text,
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text,
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_name text;
