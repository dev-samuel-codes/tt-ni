-- rollback: DROP TABLE IF EXISTS public.synergy_groups, public.nutrient_antagonism, public.nutrient_timing, public.medication_aliases CASCADE;

-- =============================================================================
-- 시너지 그룹 테이블
-- 함께 복용 시 상호 보완 효과를 내는 영양소 조합을 저장합니다.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.synergy_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  nutrient_ids text[] NOT NULL,
  benefit text NOT NULL,
  report_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.synergy_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "synergy groups readable" ON public.synergy_groups FOR SELECT TO authenticated USING (true);

INSERT INTO public.synergy_groups (label, nutrient_ids, benefit, report_reference) VALUES
  ('CoQ10 + 오메가3', ARRAY['coq10','omega3'], '혈관 내피세포 건강과 항산화 네트워크가 강화되어 심혈관 보호 효과가 배가됩니다. CoQ10이 미토콘드리아 ATP 생성을, 오메가3가 혈류를 개선합니다.', '보고서 2.1절'),
  ('비타민 C + 철분', ARRAY['vitamin_c','iron'], '비타민 C가 비헴철(식물성 철분)을 흡수되기 쉬운 환원 상태(Fe²⁺)로 유지시켜 철분 흡수율을 극대화합니다. 빈혈 예방에 탁월한 조합입니다.', '보고서 2.1절'),
  ('비타민 E + 오메가3', ARRAY['vitamin_e','omega3'], '오메가3의 이중 결합이 활성산소에 의해 산화되는 것을 비타민 E가 방어합니다. 오메가3의 구조적 온전성을 보존하여 노화 방지 효능을 유지합니다.', '보고서 2.1절'),
  ('비타민 C + 콜라겐', ARRAY['vitamin_c','collagen'], '비타민 C는 콜라겐 합성의 필수 조효소로, 프롤린과 라이신의 수산화 반응을 촉진하여 피부 탄력과 관절 건강을 개선합니다.', '보고서 2.1절'),
  ('비타민 E + CoQ10', ARRAY['vitamin_e','coq10'], '지용성 항산화제인 비타민 E와 미토콘드리아 항산화제인 CoQ10이 이중 항산화 방어벽을 형성하여 세포막을 보호합니다.', '보고서 2.1절'),
  ('철분 + 비타민 C + 셀레늄', ARRAY['iron','vitamin_c','selenium'], '비타민 C가 철분 흡수를 돕고, 셀레늄이 흡수된 철분의 산화를 방지하여 조혈 기능과 조직 산소 공급을 강화합니다.', '보고서 2.1절')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 길항작용 그룹 테이블
-- 동시 복용 시 흡수 경쟁이 발생하는 영양소 쌍을 저장합니다.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.nutrient_antagonism (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  nutrient_ids text[] NOT NULL,
  reason text NOT NULL,
  min_interval_hours integer NOT NULL DEFAULT 2,
  severity text NOT NULL DEFAULT 'caution' CHECK (severity IN ('notice', 'caution', 'high')),
  report_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrient_antagonism ENABLE ROW LEVEL SECURITY;
CREATE POLICY "antagonism groups readable" ON public.nutrient_antagonism FOR SELECT TO authenticated USING (true);

INSERT INTO public.nutrient_antagonism (label, nutrient_ids, reason, min_interval_hours, severity, report_reference) VALUES
  ('칼슘 ↔ 철분', ARRAY['calcium','iron'], '장관 점막의 DMT1(2가 금속 수송체)를 공유하여 흡수 경쟁이 발생합니다. 동시 복용 시 철분 흡수율이 크게 저하됩니다.', 2, 'caution', '보고서 2.2절'),
  ('칼슘 ↔ 마그네슘', ARRAY['calcium','magnesium'], '두 다가 양이온이 같은 흡수 채널을 두고 경쟁하여 상호 흡수율이 감소합니다.', 2, 'caution', '보고서 2.2절'),
  ('칼슘 ↔ 아연', ARRAY['calcium','zinc'], '다가 양이온 간 흡수 경쟁으로 인해 아연의 생체이용률이 저하됩니다.', 2, 'caution', '보고서 2.2절'),
  ('철분 ↔ 아연', ARRAY['iron','zinc'], 'DMT1 수송체를 공유하여 경쟁적 흡수 억제가 발생합니다.', 2, 'caution', '보고서 2.2절'),
  ('칼슘 ↔ 마그네슘 ↔ 아연', ARRAY['calcium','magnesium','zinc'], '세 다가 양이온이 동일한 흡수 경로에서 경쟁하므로 동시 복용을 피해야 합니다.', 2, 'caution', '보고서 2.2절')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 영양소 복용 타이밍 테이블
-- 각 영양소의 권장 복용 시간대(공복/식후/저녁)를 저장합니다.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.nutrient_timing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrient_id text NOT NULL REFERENCES public.nutrients(id) ON DELETE CASCADE,
  time_category text NOT NULL CHECK (time_category IN ('empty_stomach', 'after_meal', 'evening', 'evening_or_after')),
  priority integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(nutrient_id, time_category)
);

ALTER TABLE public.nutrient_timing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrient timing readable" ON public.nutrient_timing FOR SELECT TO authenticated USING (true);

INSERT INTO public.nutrient_timing (nutrient_id, time_category, priority, note) VALUES
  ('probiotics', 'empty_stomach', 1, '공복에 흡수율이 높고 위산 분비 전에 섭취'),
  ('vitamin_b1', 'empty_stomach', 0, '수용성 비타민은 공복 흡수율 우수'),
  ('vitamin_b6', 'empty_stomach', 0, '수용성 비타민'),
  ('vitamin_b12', 'empty_stomach', 0, '수용성 비타민'),
  ('vitamin_c', 'empty_stomach', 0, '수용성 비타민'),
  ('iron', 'empty_stomach', 1, '공복에 흡수율이 가장 높음'),
  ('ginseng', 'empty_stomach', 0, '기상 직후 복용 시 활력 증진'),
  ('choline', 'empty_stomach', 0, '콜린성 신경 전달 촉진'),
  ('vitamin_a', 'after_meal', 0, '지용성 비타민은 식사 지방과 함께 흡수'),
  ('vitamin_d', 'after_meal', 1, '지용성 비타민, 지방과 함께 섭취 필수'),
  ('vitamin_e', 'after_meal', 0, '지용성 비타민'),
  ('vitamin_k', 'after_meal', 0, '지용성 비타민'),
  ('omega3', 'after_meal', 1, '식사 지방이 오메가3 유화 및 흡수 촉진'),
  ('coq10', 'after_meal', 0, '지용성 항산화제'),
  ('calcium', 'evening', 1, '밤 시간대 골 흡수 최적화 및 숙면 도움'),
  ('magnesium', 'evening', 1, '숙면 유도 및 근육 이완'),
  ('zinc', 'evening_or_after', 0, '저녁-식후 모두 가능, Ca/Mg와 겹치면 식후로 분리')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 약물명 별칭 테이블
-- DNI 규칙의 medication_keyword에 대한 한국어/영어/브랜드명 별칭을 저장합니다.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.medication_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_keyword text NOT NULL,
  alias text NOT NULL,
  alias_type text NOT NULL DEFAULT 'generic' CHECK (alias_type IN ('generic', 'brand', 'category')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(medication_keyword, alias)
);

ALTER TABLE public.medication_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medication aliases readable" ON public.medication_aliases FOR SELECT TO authenticated USING (true);

INSERT INTO public.medication_aliases (medication_keyword, alias, alias_type) VALUES
  ('warfarin', 'warfarin', 'generic'),
  ('warfarin', '와파린', 'generic'),
  ('warfarin', '쿠마딘', 'brand'),
  ('warfarin', '항응고', 'category'),
  ('metformin', 'metformin', 'generic'),
  ('metformin', '메트포르민', 'generic'),
  ('metformin', '글루코파지', 'brand'),
  ('insulin', 'insulin', 'generic'),
  ('insulin', '인슐린', 'generic'),
  ('statin', 'statin', 'generic'),
  ('statin', '스타틴', 'generic'),
  ('statin', '로수바스타틴', 'brand'),
  ('statin', '아토르바스타틴', 'brand'),
  ('statin', '심바스타틴', 'brand'),
  ('statin', '프라바스타틴', 'brand'),
  ('statin', '피타바스타틴', 'brand'),
  ('antibiotic', 'antibiotic', 'generic'),
  ('antibiotic', '항생제', 'generic'),
  ('antibiotic', '세파', 'brand'),
  ('antibiotic', '페니실린', 'brand'),
  ('antibiotic', '아목시실린', 'brand'),
  ('antibiotic', '독시사이클린', 'brand'),
  ('antibiotic', '아지트로마이신', 'brand'),
  ('antibiotic', '클래리스로마이신', 'brand'),
  ('bisphosphonate', 'bisphosphonate', 'generic'),
  ('bisphosphonate', '비스포스포네이트', 'generic'),
  ('bisphosphonate', '알렌드로네이트', 'brand'),
  ('bisphosphonate', '리세드로네이트', 'brand'),
  ('bisphosphonate', '골다공증약', 'category'),
  ('levothyroxine', 'levothyroxine', 'generic'),
  ('levothyroxine', '레보티록신', 'generic'),
  ('levothyroxine', '씬지로이드', 'brand'),
  ('levothyroxine', '갑상선', 'category'),
  ('aspirin', 'aspirin', 'generic'),
  ('aspirin', '아스피린', 'generic'),
  ('aspirin', '바이엘', 'brand')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 권한 부여
-- =============================================================================
GRANT SELECT ON public.synergy_groups TO authenticated;
GRANT SELECT ON public.nutrient_antagonism TO authenticated;
GRANT SELECT ON public.nutrient_timing TO authenticated;
GRANT SELECT ON public.medication_aliases TO authenticated;
