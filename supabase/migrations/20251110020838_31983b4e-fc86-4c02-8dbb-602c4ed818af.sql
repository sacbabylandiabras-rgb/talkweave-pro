-- Fix RLS policies to be PERMISSIVE instead of RESTRICTIVE

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow public access for campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow public access for campaign_sends" ON campaign_sends;
DROP POLICY IF EXISTS "Allow public access for message_templates" ON message_templates;
DROP POLICY IF EXISTS "Allow public access for auto_responses" ON auto_responses;
DROP POLICY IF EXISTS "Allow public access for auto_response_config" ON auto_response_config;
DROP POLICY IF EXISTS "Allow public access for message_logs" ON message_logs;
DROP POLICY IF EXISTS "Allow public access for welcome_message_config" ON welcome_message_config;
DROP POLICY IF EXISTS "Allow public access for welcome_message_sent" ON welcome_message_sent;

-- Create new PERMISSIVE policies for all operations
CREATE POLICY "Enable all access for campaigns" 
ON campaigns 
AS PERMISSIVE
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for campaign_sends" 
ON campaign_sends 
AS PERMISSIVE
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for message_templates" 
ON message_templates 
AS PERMISSIVE
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for auto_responses" 
ON auto_responses 
AS PERMISSIVE
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for auto_response_config" 
ON auto_response_config 
AS PERMISSIVE
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for message_logs" 
ON message_logs 
AS PERMISSIVE
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for welcome_message_config" 
ON welcome_message_config 
AS PERMISSIVE
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for welcome_message_sent" 
ON welcome_message_sent 
AS PERMISSIVE
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);