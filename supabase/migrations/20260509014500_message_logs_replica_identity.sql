-- Set replica identity to FULL to ensure realtime updates contain all columns
ALTER TABLE message_logs REPLICA IDENTITY FULL;
