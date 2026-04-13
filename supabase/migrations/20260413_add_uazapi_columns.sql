-- Add uazapi credentials columns to profiles for community member extraction
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uazapi_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uazapi_token text;
