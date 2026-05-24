CREATE TABLE IF NOT EXISTS gateway_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES gateway_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT DEFAULT 'one-time',
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE gateway_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view plans of their products" ON gateway_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gateway_products
      WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create plans for their products" ON gateway_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM gateway_products
      WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update plans of their products" ON gateway_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM gateway_products
      WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete plans of their products" ON gateway_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM gateway_products
      WHERE gateway_products.id = gateway_plans.product_id
      AND gateway_products.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_gateway_plans_product_id ON gateway_plans(product_id);
