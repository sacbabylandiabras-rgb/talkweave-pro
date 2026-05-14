ALTER TABLE public.flow_captured_data ADD COLUMN IF NOT EXISTS cpf text;

CREATE TABLE IF NOT EXISTS public.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  tag_id text NOT NULL,
  tag_name text NOT NULL,
  tag_color integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, phone, tag_id)
);

ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own contact tags" ON public.contact_tags;
CREATE POLICY "Users can manage their own contact tags"
ON public.contact_tags FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contact_tags_user_phone ON public.contact_tags(user_id, phone);
