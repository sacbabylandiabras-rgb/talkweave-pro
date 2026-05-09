-- Update current usage_count based on campaign_sends
UPDATE message_templates mt
SET usage_count = (
  SELECT count(cs.id)
  FROM campaign_sends cs
  JOIN campaigns c ON cs.campaign_id = c.id
  WHERE c.template_id = mt.id
);

-- Function to increment usage_count
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Find the template_id from the campaign
  UPDATE message_templates
  SET usage_count = usage_count + 1
  WHERE id = (
    SELECT template_id 
    FROM campaigns 
    WHERE id = NEW.campaign_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on campaign_sends
DROP TRIGGER IF EXISTS tr_increment_template_usage ON campaign_sends;
CREATE TRIGGER tr_increment_template_usage
AFTER INSERT ON campaign_sends
FOR EACH ROW
EXECUTE FUNCTION increment_template_usage();
