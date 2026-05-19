-- API usage tracking table for daily rate limiting
CREATE TABLE IF NOT EXISTS api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  api_type text NOT NULL,
  call_count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, usage_date, api_type)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date_type ON api_usage(user_id, usage_date, api_type);

-- RLS policies
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API usage" ON api_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API usage" ON api_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API usage" ON api_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can manage all
CREATE POLICY "Service role can manage API usage" ON api_usage
  FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_api_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_api_usage_updated_at
  BEFORE UPDATE ON api_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_api_usage_updated_at();
