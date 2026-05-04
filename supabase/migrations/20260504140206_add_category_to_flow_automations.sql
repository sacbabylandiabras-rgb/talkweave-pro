ALTER TABLE public.flow_automations
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'contacts';

CREATE INDEX IF NOT EXISTS idx_flow_automations_user_category
  ON public.flow_automations(user_id, category);
