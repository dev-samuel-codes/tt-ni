-- 롤백: DROP TABLE IF EXISTS public.dosage_schedules;

CREATE TABLE IF NOT EXISTS public.dosage_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_date date NOT NULL,
  slots jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, schedule_date)
);

ALTER TABLE public.dosage_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own schedules all" ON public.dosage_schedules
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dosage_schedules TO authenticated;
