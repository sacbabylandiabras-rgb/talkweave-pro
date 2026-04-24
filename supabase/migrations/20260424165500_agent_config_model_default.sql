ALTER TABLE public.agent_config
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS model text;

UPDATE public.agent_config
SET model = CASE
  WHEN provider = 'anthropic' THEN 'claude-sonnet-4-5-20250929'
  ELSE 'google/gemini-3-flash-preview'
END
WHERE model IS NULL OR btrim(model) = '';
