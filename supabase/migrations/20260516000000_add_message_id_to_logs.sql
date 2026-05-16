ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS message_id TEXT; CREATE INDEX IF NOT EXISTS idx_message_logs_message_id ON message_logs(message_id);
