-- 롤백: ALTER TABLE public.user_conditions DROP CONSTRAINT IF EXISTS uq_user_conditions_user_condition;
-- 롤백: ALTER TABLE public.user_medications DROP CONSTRAINT IF EXISTS uq_user_medications_user_med;

-- 기존 delete+insert 패턴으로 인해 (user_id, condition_code) 중복이 있을 수 있으므로
-- 먼저 중복 행을 제거하고(최신 행만 유지), 그 후 unique 제약을 추가합니다.

DELETE FROM public.user_conditions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, condition_code) id
  FROM public.user_conditions
  ORDER BY user_id, condition_code, created_at DESC
);

ALTER TABLE public.user_conditions
  ADD CONSTRAINT IF NOT EXISTS uq_user_conditions_user_condition UNIQUE (user_id, condition_code);

DELETE FROM public.user_medications
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, medication_name) id
  FROM public.user_medications
  ORDER BY user_id, medication_name, updated_at DESC NULLS LAST
);

ALTER TABLE public.user_medications
  ADD CONSTRAINT IF NOT EXISTS uq_user_medications_user_med UNIQUE (user_id, medication_name);
