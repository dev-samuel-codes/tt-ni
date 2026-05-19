-- 롤백: DELETE FROM public.interaction_rules WHERE source_note LIKE 'Report:%' AND source_note NOT LIKE 'MVP%';
-- 롤백: DELETE FROM public.nutrients WHERE id IN ('choline', 'ginseng', 'grapefruit', 'coq10', 'probiotics');

-- 누락된 영양소 추가 (nutritionData.ts와 동기화)
INSERT INTO public.nutrients (id, standard_name, category, aliases, default_unit, risk_level) VALUES
  ('choline', '콜린', '비타민', array['choline', '콜린'], 'mg', 'medium'),
  ('ginseng', '홍삼', '허브/추출물', array['ginseng', 'red ginseng', '홍삼', '인삼', '진세노사이드', 'ginsenoside'], 'mg', 'high'),
  ('grapefruit', '자몽 추출물', '허브/추출물', array['grapefruit', '자몽', '자몽추출물'], 'mg', 'high'),
  ('coq10', '코엔자임 Q10', '항산화제', array['coq10', '코엔자임', '코엔자임큐텐', 'ubiquinone', '유비퀴논'], 'mg', 'low'),
  ('probiotics', '유산균', '유익균', array['probiotics', '프로바이오틱스', '유산균', 'lactobacillus'], 'CFU', 'low')
ON CONFLICT (id) DO UPDATE SET
  standard_name = EXCLUDED.standard_name,
  category = EXCLUDED.category,
  aliases = EXCLUDED.aliases,
  default_unit = EXCLUDED.default_unit,
  risk_level = EXCLUDED.risk_level;

-- 신규 영양소 기준값 추가
INSERT INTO public.nutrient_reference_values (nutrient_id, gender, age_min, age_max, rda, ai, ul, unit, source_note) VALUES
  ('choline', 'male', 19, 150, 550, null, 3500, 'mg', 'Report: KDRI 2025 choline'),
  ('choline', 'female', 19, 150, 425, null, 3500, 'mg', 'Report: KDRI 2025 choline')
ON CONFLICT DO NOTHING;

-- 보고서 제3장 기반 상호작용 규칙 확장
INSERT INTO public.interaction_rules (nutrient_id, medication_keyword, condition_code, severity, message, source_note)
SELECT * FROM (VALUES
  ('vitamin_c', 'aspirin', null::text, 'high', '아스피린 복용 중 고용량 비타민 C는 위장관 출혈 위험을 높일 수 있으므로 중성화된 비타민 C를 권장하거나 식후 복용하세요.', 'Report: Aspirin + high-dose vitamin C GI bleeding risk'),
  ('ginseng', 'warfarin', null, 'high', '와파린 복용 중 홍삼(진세노사이드) 섭취는 출혈 위험을 높일 수 있으므로 주의가 필요합니다.', 'Report: Ginseng antiplatelet effect with warfarin'),
  ('vitamin_e', 'warfarin', null, 'caution', '와파린 복용 중 고용량 비타민 E는 혈소판 응집을 억제하여 출혈 위험을 증가시킬 수 있습니다.', 'Report: Vitamin E antiplatelet with warfarin'),
  ('magnesium', 'calcium_supplement', null, 'caution', '칼슘과 마그네슘은 동시 복용 시 다가 양이온 흡수 경쟁이 발생하므로 2시간 이상 간격을 두는 것이 좋습니다.', 'Report: Divalent cation transporter competition'),
  ('zinc', 'calcium_supplement', null, 'caution', '칼슘과 아연은 동시 복용 시 다가 양이온 흡수 경쟁이 발생하므로 2시간 이상 간격을 두는 것이 좋습니다.', 'Report: Divalent cation transporter competition'),
  ('zinc', 'iron_supplement', null, 'caution', '철분과 아연은 동시 복용 시 DMT1 수송체 경쟁이 발생하므로 2시간 이상 간격을 두는 것이 좋습니다.', 'Report: DMT1 transporter competition'),
  ('calcium', 'levothyroxine', null, 'high', '갑상선 호르몬제(레보티록신)와 칼슘은 최소 2시간, 철분과는 최소 4시간 간격을 두고 복용하세요.', 'Report: Levothyroxine mineral spacing'),
  ('magnesium', 'bisphosphonate', null, 'high', '골다공증 약(비스포스포네이트)과 마그네슘은 킬레이트 형성을 방지하기 위해 2시간 이상 간격을 두세요.', 'Report: Bisphosphonate chelation'),
  ('grapefruit', 'statin', null, 'high', '스타틴 계열 고지혈증 약과 자몽 추출물은 CYP3A4 대사 효소 억제로 횡문근융해증 위험이 있어 절대 병용 금기입니다.', 'Report: CYP3A4 irreversible inhibition'),
  ('ginseng', 'insulin', null, 'high', '인슐린/설포닐우레아 계열 당뇨약과 홍삼은 중증 저혈당 쇼크 위험이 있어 병용 시 전문가 상담이 필수입니다.', 'Report: Ginsenoside hypoglycemic amplification'),
  ('vitamin_b12', 'metformin', null, 'notice', '메트포르민 장기 복용자는 비타민 B12 결핍 위험이 있으므로 정기적 혈중 농도 확인과 보충을 권장합니다.', 'Report: Metformin B12 depletion recommendation'),
  ('coq10', 'statin', null, 'notice', '스타틴은 체내 코엔자임 Q10 합성을 저해하므로 근육통/피로 예방을 위해 CoQ10 보충이 권장됩니다.', 'Report: Statin mevalonate pathway CoQ10 depletion')
) AS v(nutrient_id, medication_keyword, condition_code, severity, message, source_note)
WHERE NOT EXISTS (
  SELECT 1 FROM public.interaction_rules existing
  WHERE existing.nutrient_id = v.nutrient_id
    AND COALESCE(existing.medication_keyword, '') = COALESCE(v.medication_keyword, '')
    AND COALESCE(existing.condition_code, '') = COALESCE(v.condition_code, '')
);
