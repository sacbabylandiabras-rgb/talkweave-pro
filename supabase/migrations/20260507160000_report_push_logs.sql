CREATE TABLE IF NOT EXISTS report_push_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_key TEXT NOT NULL,
    messages_sent INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    sales_amount BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, slot_key)
);

ALTER TABLE report_push_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own report logs" ON report_push_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all report logs" ON report_push_logs
    USING (true) WITH CHECK (true);
