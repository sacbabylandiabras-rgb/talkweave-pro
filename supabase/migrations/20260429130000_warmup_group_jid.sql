ALTER TABLE public.warmup_group_links
  ADD COLUMN IF NOT EXISTS group_jid text;
