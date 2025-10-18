-- Add delay_seconds column to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN delay_seconds integer DEFAULT 2;

COMMENT ON COLUMN public.campaigns.delay_seconds IS 'Delay in seconds between each message send to avoid rate limiting';