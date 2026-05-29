-- Add voice column to agent_config for TTS voice selection
ALTER TABLE public.agent_config
  ADD COLUMN IF NOT EXISTS voice text NOT NULL DEFAULT 'nova';
