ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_acquirer text DEFAULT NULL;
COMMENT ON COLUMN public.profiles.pix_acquirer IS 'Per-user acquirer override: openpix, hubpague, or NULL for platform default';
