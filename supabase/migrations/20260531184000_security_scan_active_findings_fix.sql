-- Resolve active scanner findings by restricting public-role RLS surfaces and tightening profile/storage access.

-- Flow/gateway owner tables: authenticated users only.
DROP POLICY IF EXISTS "Users can view own flow_automations" ON public.flow_automations;
DROP POLICY IF EXISTS "Users can create own flow_automations" ON public.flow_automations;
DROP POLICY IF EXISTS "Users can update own flow_automations" ON public.flow_automations;
DROP POLICY IF EXISTS "Users can delete own flow_automations" ON public.flow_automations;
CREATE POLICY "Users can view own flow_automations"
  ON public.flow_automations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own flow_automations"
  ON public.flow_automations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flow_automations"
  ON public.flow_automations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own flow_automations"
  ON public.flow_automations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own gateway_funnels" ON public.gateway_funnels;
DROP POLICY IF EXISTS "Users can create own gateway_funnels" ON public.gateway_funnels;
DROP POLICY IF EXISTS "Users can update own gateway_funnels" ON public.gateway_funnels;
DROP POLICY IF EXISTS "Users can delete own gateway_funnels" ON public.gateway_funnels;
CREATE POLICY "Users can view own gateway_funnels"
  ON public.gateway_funnels FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own gateway_funnels"
  ON public.gateway_funnels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gateway_funnels"
  ON public.gateway_funnels FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own gateway_funnels"
  ON public.gateway_funnels FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own gateway_integrations" ON public.gateway_integrations;
DROP POLICY IF EXISTS "Users can create own gateway_integrations" ON public.gateway_integrations;
DROP POLICY IF EXISTS "Users can update own gateway_integrations" ON public.gateway_integrations;
DROP POLICY IF EXISTS "Users can delete own gateway_integrations" ON public.gateway_integrations;
CREATE POLICY "Users can view own gateway_integrations"
  ON public.gateway_integrations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own gateway_integrations"
  ON public.gateway_integrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gateway_integrations"
  ON public.gateway_integrations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own gateway_integrations"
  ON public.gateway_integrations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own gateway_webhook_logs" ON public.gateway_webhook_logs;
DROP POLICY IF EXISTS "Users can create own gateway_webhook_logs" ON public.gateway_webhook_logs;
CREATE POLICY "Users can view own gateway_webhook_logs"
  ON public.gateway_webhook_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own gateway_webhook_logs"
  ON public.gateway_webhook_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Affiliate relationships: authenticated-only and owner scoped.
DROP POLICY IF EXISTS "Product owners can see their affiliates" ON public.gateway_affiliates;
DROP POLICY IF EXISTS "Users can affiliate themselves" ON public.gateway_affiliates;
DROP POLICY IF EXISTS "Users can see their own affiliations" ON public.gateway_affiliates;
CREATE POLICY "Product owners can see their affiliates"
  ON public.gateway_affiliates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gateway_products
    WHERE gateway_products.id = gateway_affiliates.product_id
      AND gateway_products.user_id = auth.uid()
  ));
CREATE POLICY "Users can see their own affiliations"
  ON public.gateway_affiliates FOR SELECT TO authenticated
  USING (auth.uid() = affiliate_id);
CREATE POLICY "Users can affiliate themselves"
  ON public.gateway_affiliates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = affiliate_id);

-- Plans: keep owner visibility but remove anonymous access and add WITH CHECK for writes.
DROP POLICY IF EXISTS "Users can manage plans of their products" ON public.gateway_plans;
DROP POLICY IF EXISTS "Users can view plans of their products" ON public.gateway_plans;
DROP POLICY IF EXISTS "Users can create plans for their products" ON public.gateway_plans;
DROP POLICY IF EXISTS "Users can update plans of their products" ON public.gateway_plans;
DROP POLICY IF EXISTS "Users can delete plans of their products" ON public.gateway_plans;
CREATE POLICY "Users can view plans of their products"
  ON public.gateway_plans FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gateway_products
    WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
  ));
CREATE POLICY "Users can create plans for their products"
  ON public.gateway_plans FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.gateway_products
    WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
  ));
CREATE POLICY "Users can update plans of their products"
  ON public.gateway_plans FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gateway_products
    WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.gateway_products
    WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete plans of their products"
  ON public.gateway_plans FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gateway_products
    WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
  ));

-- Profiles: users may update only their own profile row; privileged columns remain protected by column grants + trigger.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Receipt bucket: private, owner-folder scoped policies, no anonymous uploads.
UPDATE storage.buckets SET public = false WHERE id = 'payment-receipts';

DROP POLICY IF EXISTS "Owners can read payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read payment receipts" ON storage.objects;

CREATE POLICY "Owners can read payment receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners can upload payment receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners can update payment receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners can delete payment receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins can read payment receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'::app_role));
