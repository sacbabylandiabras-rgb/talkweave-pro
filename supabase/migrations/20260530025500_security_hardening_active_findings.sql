-- Fix active scanner findings: protect gateway config, profile privileged fields, and receipt storage.

-- Platform config must be admin-only for authenticated browser clients.
DROP POLICY IF EXISTS "Authenticated can read platform config" ON public.gateway_platform_config;
DROP POLICY IF EXISTS "Anyone can read platform config" ON public.gateway_platform_config;
DROP POLICY IF EXISTS "Admins can read platform config" ON public.gateway_platform_config;
CREATE POLICY "Admins can read platform config"
  ON public.gateway_platform_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Limit direct profile updates to user-editable columns only; privileged fields are changed by service-role Edge Functions.
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, whatsapp, document, document_type, email_sender_name, email_sender_address, pipeline_stages, updated_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

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

-- Payment receipts are private and readable only by the owning tenant folder or admins.
UPDATE storage.buckets SET public = false WHERE id = 'payment-receipts';

DROP POLICY IF EXISTS "Owners can read payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read payment receipts" ON storage.objects;

CREATE POLICY "Owners can read payment receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners can upload payment receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can read payment receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Add a minimal policy to the mapping table so RLS is not enabled without policies.
GRANT SELECT, INSERT ON public.sent_emails_mapping TO authenticated;
GRANT ALL ON public.sent_emails_mapping TO service_role;
DROP POLICY IF EXISTS "Users can manage own sent email mappings" ON public.sent_emails_mapping;
CREATE POLICY "Users can manage own sent email mappings"
  ON public.sent_emails_mapping
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
