ALTER TABLE public.gateway_landing_pages
  ADD COLUMN IF NOT EXISTS checkout_id uuid REFERENCES public.gateway_checkouts(id) ON DELETE SET NULL;
