-- CRITICAL SECURITY FIX: Add user isolation to all tables
-- This prevents users from seeing each other's data

-- 1. Add user_id column to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add user_id column to campaign_sends
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Add user_id column to message_templates
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Add user_id column to message_logs
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Add user_id column to auto_responses
ALTER TABLE auto_responses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. Add user_id column to auto_response_config
ALTER TABLE auto_response_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Add user_id column to welcome_message_config
ALTER TABLE welcome_message_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 8. Add user_id column to welcome_message_sent
ALTER TABLE welcome_message_sent ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop all existing "Enable all access" policies
DROP POLICY IF EXISTS "Enable all access for campaigns" ON campaigns;
DROP POLICY IF EXISTS "Enable all access for campaign_sends" ON campaign_sends;
DROP POLICY IF EXISTS "Enable all access for message_templates" ON message_templates;
DROP POLICY IF EXISTS "Enable all access for message_logs" ON message_logs;
DROP POLICY IF EXISTS "Enable all access for auto_responses" ON auto_responses;
DROP POLICY IF EXISTS "Enable all access for auto_response_config" ON auto_response_config;
DROP POLICY IF EXISTS "Enable all access for welcome_message_config" ON welcome_message_config;
DROP POLICY IF EXISTS "Enable all access for welcome_message_sent" ON welcome_message_sent;

-- Create secure RLS policies for campaigns
CREATE POLICY "Users can view own campaigns"
ON campaigns FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaigns"
ON campaigns FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
ON campaigns FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
ON campaigns FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for campaign_sends
CREATE POLICY "Users can view own campaign_sends"
ON campaign_sends FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaign_sends"
ON campaign_sends FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaign_sends"
ON campaign_sends FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaign_sends"
ON campaign_sends FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for message_templates
CREATE POLICY "Users can view own message_templates"
ON message_templates FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own message_templates"
ON message_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own message_templates"
ON message_templates FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own message_templates"
ON message_templates FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for message_logs
CREATE POLICY "Users can view own message_logs"
ON message_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own message_logs"
ON message_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own message_logs"
ON message_logs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own message_logs"
ON message_logs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for auto_responses
CREATE POLICY "Users can view own auto_responses"
ON auto_responses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own auto_responses"
ON auto_responses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auto_responses"
ON auto_responses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own auto_responses"
ON auto_responses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for auto_response_config
CREATE POLICY "Users can view own auto_response_config"
ON auto_response_config FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own auto_response_config"
ON auto_response_config FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auto_response_config"
ON auto_response_config FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own auto_response_config"
ON auto_response_config FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for welcome_message_config
CREATE POLICY "Users can view own welcome_message_config"
ON welcome_message_config FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own welcome_message_config"
ON welcome_message_config FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own welcome_message_config"
ON welcome_message_config FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own welcome_message_config"
ON welcome_message_config FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for welcome_message_sent
CREATE POLICY "Users can view own welcome_message_sent"
ON welcome_message_sent FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own welcome_message_sent"
ON welcome_message_sent FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own welcome_message_sent"
ON welcome_message_sent FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own welcome_message_sent"
ON welcome_message_sent FOR DELETE
TO authenticated
USING (auth.uid() = user_id);