-- rollback: DELETE FROM public.nutrient_reference_values WHERE source_note LIKE 'KDRI 2025%';
-- rollback: DELETE FROM public.interaction_rules WHERE source_note IN ('Report: Antibiotics neutralize probiotics', 'Report: Bisphosphonate chelation with calcium');

-- =============================================================================
-- KDRI 2025 영양소 섭취기준 참조값 추가
-- 초기/확장 마이그레이션에서 누락된 비타민 및 미네랄의 권장섭취량(RDA)과
-- 상한섭취량(UL)을 추가합니다. AI(충분섭취량)는 RDA가 설정되지 않은 경우 사용합니다.
-- =============================================================================

-- 수용성 비타민
INSERT INTO public.nutrient_reference_values (nutrient_id, gender, age_min, age_max, rda, ai, ul, unit, source_note) VALUES
  ('vitamin_b1', 'male', 19, 150, 1.2, null, null, 'mg', 'KDRI 2025 vitamin_b1'),
  ('vitamin_b1', 'female', 19, 150, 1.1, null, null, 'mg', 'KDRI 2025 vitamin_b1'),
  ('vitamin_b2', 'male', 19, 150, 1.5, null, null, 'mg', 'KDRI 2025 vitamin_b2'),
  ('vitamin_b2', 'female', 19, 150, 1.2, null, null, 'mg', 'KDRI 2025 vitamin_b2'),
  ('vitamin_b6', 'any', 19, 64, 1.3, null, 100, 'mg', 'KDRI 2025 vitamin_b6'),
  ('vitamin_b6', 'any', 65, 150, 1.5, null, 100, 'mg', 'KDRI 2025 vitamin_b6'),
  ('vitamin_b12', 'any', 19, 150, 2.4, null, null, 'mcg', 'KDRI 2025 vitamin_b12'),
  ('niacin', 'male', 19, 150, 16, null, 35, 'mg', 'KDRI 2025 niacin'),
  ('niacin', 'female', 19, 150, 14, null, 35, 'mg', 'KDRI 2025 niacin'),
  ('folate', 'any', 19, 150, 400, null, 1000, 'mcg', 'KDRI 2025 folate'),
  ('biotin', 'any', 19, 150, null, 30, null, 'mcg', 'KDRI 2025 biotin'),
  ('pantothenic_acid', 'any', 19, 150, null, 5, null, 'mg', 'KDRI 2025 pantothenic_acid'),

  -- 미네랄
  ('selenium', 'male', 19, 150, 85, null, 400, 'mcg', 'KDRI 2025 selenium'),
  ('selenium', 'female', 19, 150, 75, null, 400, 'mcg', 'KDRI 2025 selenium'),
  ('iodine', 'any', 19, 150, 150, null, 500, 'mcg', 'KDRI 2025 iodine'),
  ('copper', 'any', 19, 150, 0.8, null, 10, 'mg', 'KDRI 2025 copper'),
  ('manganese', 'male', 19, 150, null, 4.0, 11, 'mg', 'KDRI 2025 manganese'),
  ('manganese', 'female', 19, 150, null, 3.5, 11, 'mg', 'KDRI 2025 manganese'),
  ('chromium', 'male', 19, 50, null, 35, null, 'mcg', 'KDRI 2025 chromium'),
  ('chromium', 'female', 19, 50, null, 25, null, 'mcg', 'KDRI 2025 chromium'),
  ('phosphorus', 'any', 19, 150, 700, null, 3500, 'mg', 'KDRI 2025 phosphorus'),
  ('potassium', 'any', 19, 150, null, 3500, null, 'mg', 'KDRI 2025 potassium'),
  ('sodium', 'any', 19, 150, null, 1500, 2300, 'mg', 'KDRI 2025 sodium')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 누락된 약물-영양소 상호작용 규칙 추가
-- run-analysis Edge Function의 하드코딩된 interactionRules 배열과 동기화
-- =============================================================================

INSERT INTO public.interaction_rules (nutrient_id, medication_keyword, condition_code, severity, message, source_note)
SELECT * FROM (VALUES
  ('probiotics', 'antibiotic', null::text, 'high',
   '항생제 복용 시 유산균이 사멸하므로 최소 2시간 이상의 간격을 두고 섭취하세요.',
   'Report: Antibiotics neutralize probiotics'),
  ('calcium', 'bisphosphonate', null, 'high',
   '골다공증 약(비스포스포네이트)은 칼슘과 킬레이트를 형성하므로 최소 2시간 간격을 두고 복용하세요.',
   'Report: Bisphosphonate chelation with calcium')
) AS v(nutrient_id, medication_keyword, condition_code, severity, message, source_note)
WHERE NOT EXISTS (
  SELECT 1 FROM public.interaction_rules existing
  WHERE existing.nutrient_id = v.nutrient_id
    AND COALESCE(existing.medication_keyword, '') = COALESCE(v.medication_keyword, '')
    AND COALESCE(existing.condition_code, '') = COALESCE(v.condition_code, '')
);
