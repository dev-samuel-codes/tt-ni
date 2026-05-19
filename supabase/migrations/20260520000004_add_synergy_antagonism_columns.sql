-- 롤백: ALTER TABLE public.analysis_reports DROP COLUMN IF EXISTS synergy_recommendations_json, DROP COLUMN IF EXISTS antagonism_warnings_json;

ALTER TABLE public.analysis_reports
  ADD COLUMN IF NOT EXISTS synergy_recommendations_json jsonb,
  ADD COLUMN IF NOT EXISTS antagonism_warnings_json jsonb;
