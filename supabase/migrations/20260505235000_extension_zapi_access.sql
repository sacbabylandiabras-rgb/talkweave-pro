-- Allow extension to read Z-API instances to get credentials
DROP POLICY IF EXISTS "Extension anon read zapi_instances" ON zapi_instances;
CREATE POLICY "Extension anon read zapi_instances" ON zapi_instances
  FOR SELECT TO anon USING (true);
