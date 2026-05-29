-- Follow-up security hardening for scanner findings

-- Allow owners to delete compromised/stale gateway API keys.
DROP POLICY IF EXISTS "Owners can delete own api keys" ON public.gateway_api_keys;
CREATE POLICY "Owners can delete own api keys"
  ON public.gateway_api_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Platform configuration is internal/admin-only.
DROP POLICY IF EXISTS "Authenticated can read platform config" ON public.gateway_platform_config;
DROP POLICY IF EXISTS "Anyone can read platform config" ON public.gateway_platform_config;
DROP POLICY IF EXISTS "Admins can read platform config" ON public.gateway_platform_config;
CREATE POLICY "Admins can read platform config"
  ON public.gateway_platform_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Prevent users from self-escalating privileged profile fields.
CREATE OR REPLACE FUNCTION public.prevent_unsafe_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.is_active := OLD.is_active;
    NEW.subscription_status := OLD.subscription_status;
    NEW.subscription_expires_at := OLD.subscription_expires_at;
    NEW.plan_id := OLD.plan_id;
    NEW.custom_plan_value := OLD.custom_plan_value;
    NEW.max_instances := OLD.max_instances;
    NEW.zapi_instance_id := OLD.zapi_instance_id;
    NEW.zapi_token := OLD.zapi_token;
    NEW.zapi_client_token := OLD.zapi_client_token;
    NEW.uazapi_url := OLD.uazapi_url;
    NEW.uazapi_token := OLD.uazapi_token;
    NEW.pix_acquirer := OLD.pix_acquirer;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unsafe_profile_self_update_trg ON public.profiles;
CREATE TRIGGER prevent_unsafe_profile_self_update_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unsafe_profile_self_update();

-- Private receipt storage with owner/admin reads.
UPDATE storage.buckets SET public = false WHERE id = 'payment-receipts';

DROP POLICY IF EXISTS "Owners can read payment receipts" ON storage.objects;
CREATE POLICY "Owners can read payment receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-receipts' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners can upload payment receipts" ON storage.objects;
CREATE POLICY "Owners can upload payment receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND owner = auth.uid());

DROP POLICY IF EXISTS "Admins can read payment receipts" ON storage.objects;
CREATE POLICY "Admins can read payment receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'::app_role));
