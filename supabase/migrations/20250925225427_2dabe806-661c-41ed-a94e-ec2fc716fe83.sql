-- Add buttons column to message_templates table
ALTER TABLE public.message_templates 
ADD COLUMN buttons JSONB DEFAULT '[]'::jsonb;