-- Allow extension (anon key) to read templates/flows if user_id matches
CREATE POLICY "Extension read templates" ON message_templates
  FOR SELECT TO anon
  USING (user_id::text = (current_setting('request.querystring', true)::json->>'user_id'));

CREATE POLICY "Extension read flows" ON flow_automations
  FOR SELECT TO anon
  USING (user_id::text = (current_setting('request.querystring', true)::json->>'user_id'));

-- Allow extension to insert/read contacts
CREATE POLICY "Extension read contacts" ON saved_contacts
  FOR SELECT TO anon
  USING (user_id::text = (current_setting('request.querystring', true)::json->>'user_id'));

CREATE POLICY "Extension insert contacts" ON saved_contacts
  FOR INSERT TO anon
  WITH CHECK (true);
