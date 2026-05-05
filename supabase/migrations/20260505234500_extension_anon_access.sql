-- Allow extension (anon key) to read templates/flows filtered by user_id
DROP POLICY IF EXISTS "Extension anon read templates" ON message_templates;
CREATE POLICY "Extension anon read templates" ON message_templates
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Extension anon read flows" ON flow_automations;
CREATE POLICY "Extension anon read flows" ON flow_automations
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Extension anon insert contacts" ON saved_contacts;
CREATE POLICY "Extension anon insert contacts" ON saved_contacts
  FOR INSERT TO anon WITH CHECK (true);
