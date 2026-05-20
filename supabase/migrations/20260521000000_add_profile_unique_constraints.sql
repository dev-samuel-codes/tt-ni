-- 롤백: ALTER TABLE public.user_conditions DROP CONSTRAINT IF EXISTS uq_user_conditions_user_condition;
-- 롤백: ALTER TABLE public.user_medications DROP CONSTRAINT IF EXISTS uq_user_medications_user_med;

ALTER TABLE public.user_conditions
  ADD CONSTRAINT uq_user_conditions_user_condition UNIQUE (user_id, condition_code);

ALTER TABLE public.user_medications
  ADD CONSTRAINT uq_user_medications_user_med UNIQUE (user_id, medication_name);
