-- Add header and footer columns to message_templates table
ALTER TABLE public.message_templates 
ADD COLUMN header TEXT,
ADD COLUMN footer TEXT;