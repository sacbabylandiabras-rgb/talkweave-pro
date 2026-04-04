ALTER TABLE public.redirect_links
ADD COLUMN IF NOT EXISTS welcome_type text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS welcome_message text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS welcome_template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS welcome_flow_id uuid REFERENCES public.flow_automations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS welcome_instance_id uuid,
ADD COLUMN IF NOT EXISTS notify_admin boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_phone text NOT NULL DEFAULT '';
