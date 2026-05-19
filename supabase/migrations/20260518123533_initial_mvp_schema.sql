create extension if not exists "pgcrypto";

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  gender text not null check (gender in ('female', 'male', 'other')),
  birth_year integer not null check (birth_year between 1900 and extract(year from now())::integer),
  age_group text,
  height_cm numeric,
  weight_kg numeric,
  pregnancy_status text default 'none',
  lactation_status boolean default false,
  consent_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  condition_code text not null,
  condition_name text not null,
  severity text default 'notice',
  memo text,
  created_at timestamptz not null default now()
);

create table public.user_medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_name text not null,
  dosage_text text,
  frequency text,
  started_at date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nutrients (
  id text primary key,
  standard_name text not null,
  category text not null,
  aliases text[] not null default '{}',
  default_unit text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high'))
);

create table public.nutrient_reference_values (
  id uuid primary key default gen_random_uuid(),
  nutrient_id text not null references public.nutrients(id) on delete cascade,
  gender text not null default 'any',
  age_min integer not null default 0,
  age_max integer not null default 150,
  rda numeric,
  ai numeric,
  ul numeric,
  unit text not null,
  condition_modifier jsonb,
  source_note text,
  updated_at timestamptz not null default now()
);

create table public.interaction_rules (
  id uuid primary key default gen_random_uuid(),
  nutrient_id text not null references public.nutrients(id) on delete cascade,
  medication_keyword text,
  condition_code text,
  severity text not null check (severity in ('notice', 'caution', 'high')),
  message text not null,
  source_note text,
  created_at timestamptz not null default now()
);

create table public.supplement_products (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  brand_name text,
  source_type text not null check (source_type in ('manual', 'photo')),
  label_image_path text,
  is_public_candidate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplement_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.supplement_products(id) on delete cascade,
  nutrient_id text references public.nutrients(id),
  raw_name text not null,
  standard_name text not null,
  amount numeric,
  unit text not null,
  amount_per_daily_serving numeric,
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  review_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.supplement_products(id) on delete cascade,
  daily_servings numeric not null default 1,
  intake_time text,
  active boolean not null default true,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.label_parse_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'review', 'failed', 'confirmed')),
  raw_gpt_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status_summary jsonb not null,
  total_nutrients_json jsonb not null,
  risk_items_json jsonb not null,
  recommendations_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
alter table public.user_conditions enable row level security;
alter table public.user_medications enable row level security;
alter table public.supplement_products enable row level security;
alter table public.supplement_ingredients enable row level security;
alter table public.user_supplements enable row level security;
alter table public.label_parse_jobs enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.nutrients enable row level security;
alter table public.nutrient_reference_values enable row level security;
alter table public.interaction_rules enable row level security;

create policy "own profile read" on public.user_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "own profile insert" on public.user_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own profile update" on public.user_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own conditions all" on public.user_conditions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own medications all" on public.user_medications for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own user supplements all" on public.user_supplements for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own parse jobs all" on public.label_parse_jobs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own analysis reports all" on public.analysis_reports for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "private or public products read" on public.supplement_products
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or is_public_candidate = true);
create policy "own products insert" on public.supplement_products for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "own products update" on public.supplement_products for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "own products delete" on public.supplement_products for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy "ingredients visible through product" on public.supplement_ingredients
  for select to authenticated
  using (
    exists (
      select 1 from public.supplement_products products
      where products.id = supplement_ingredients.product_id
        and (products.owner_user_id = (select auth.uid()) or products.is_public_candidate = true)
    )
  );
create policy "ingredients writable through own product" on public.supplement_ingredients
  for all to authenticated
  using (
    exists (
      select 1 from public.supplement_products products
      where products.id = supplement_ingredients.product_id
        and products.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.supplement_products products
      where products.id = supplement_ingredients.product_id
        and products.owner_user_id = (select auth.uid())
    )
  );

create policy "reference nutrients readable" on public.nutrients for select to anon, authenticated using (true);
create policy "reference values readable" on public.nutrient_reference_values for select to anon, authenticated using (true);
create policy "interaction rules readable" on public.interaction_rules for select to authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on public.nutrients, public.nutrient_reference_values to anon, authenticated;
grant select on public.interaction_rules to authenticated;
grant all on public.user_profiles, public.user_conditions, public.user_medications, public.supplement_products, public.supplement_ingredients, public.user_supplements, public.label_parse_jobs, public.analysis_reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('label-images', 'label-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "user uploads own label images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'label-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user reads own label images" on storage.objects
  for select to authenticated
  using (bucket_id = 'label-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user updates own label images" on storage.objects
  for update to authenticated
  using (bucket_id = 'label-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'label-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user deletes own label images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'label-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

insert into public.nutrients (id, standard_name, category, aliases, default_unit, risk_level) values
  ('vitamin_a', '비타민 A', '비타민', array['vitamin a', 'retinol', '레티놀', '베타카로틴'], 'mcg', 'high'),
  ('vitamin_b1', '비타민 B1', '비타민', array['b1', 'thiamine', '티아민'], 'mg', 'low'),
  ('vitamin_b6', '비타민 B6', '비타민', array['b6', 'pyridoxine', '피리독신'], 'mg', 'medium'),
  ('vitamin_b12', '비타민 B12', '비타민', array['b12', 'cobalamin', '코발라민'], 'mcg', 'low'),
  ('vitamin_c', '비타민 C', '비타민', array['vitamin c', 'ascorbic acid', '아스코르브산'], 'mg', 'medium'),
  ('vitamin_d', '비타민 D', '비타민', array['vitamin d', 'd3', 'cholecalciferol', '콜레칼시페롤'], 'mcg', 'high'),
  ('vitamin_e', '비타민 E', '비타민', array['vitamin e', 'tocopherol', '토코페롤'], 'mg', 'medium'),
  ('vitamin_k', '비타민 K', '비타민', array['vitamin k', 'k1', 'k2', 'phylloquinone', 'menaquinone'], 'mcg', 'high'),
  ('calcium', '칼슘', '미네랄', array['calcium', 'ca', '칼슘'], 'mg', 'medium'),
  ('magnesium', '마그네슘', '미네랄', array['magnesium', '마그네슘'], 'mg', 'medium'),
  ('zinc', '아연', '미네랄', array['zinc', 'zn', '아연'], 'mg', 'medium'),
  ('iron', '철분', '미네랄', array['iron', 'fe', '철'], 'mg', 'high'),
  ('omega3', '오메가3', '지방산', array['omega 3', 'omega-3', 'epa', 'dha', '오메가'], 'mg', 'medium')
on conflict (id) do update set
  standard_name = excluded.standard_name,
  category = excluded.category,
  aliases = excluded.aliases,
  default_unit = excluded.default_unit,
  risk_level = excluded.risk_level;

insert into public.nutrient_reference_values (nutrient_id, gender, age_min, age_max, rda, ai, ul, unit, source_note) values
  ('vitamin_a', 'male', 19, 150, 900, null, 3000, 'mcg', 'MVP seed'),
  ('vitamin_a', 'female', 19, 150, 700, null, 3000, 'mcg', 'MVP seed'),
  ('vitamin_c', 'male', 19, 150, 90, null, 2000, 'mg', 'MVP seed'),
  ('vitamin_c', 'female', 19, 150, 75, null, 2000, 'mg', 'MVP seed'),
  ('vitamin_d', 'any', 19, 70, 15, null, 100, 'mcg', 'MVP seed'),
  ('vitamin_d', 'any', 71, 150, 20, null, 100, 'mcg', 'MVP seed'),
  ('vitamin_e', 'any', 19, 150, 15, null, 1000, 'mg', 'MVP seed'),
  ('vitamin_k', 'male', 19, 150, null, 120, null, 'mcg', 'MVP seed'),
  ('vitamin_k', 'female', 19, 150, null, 90, null, 'mcg', 'MVP seed'),
  ('calcium', 'any', 19, 50, 1000, null, 2500, 'mg', 'MVP seed'),
  ('calcium', 'any', 51, 150, 1200, null, 2000, 'mg', 'MVP seed'),
  ('magnesium', 'male', 19, 150, 420, null, 350, 'mg', 'MVP seed'),
  ('magnesium', 'female', 19, 150, 320, null, 350, 'mg', 'MVP seed'),
  ('zinc', 'male', 19, 150, 11, null, 40, 'mg', 'MVP seed'),
  ('zinc', 'female', 19, 150, 8, null, 40, 'mg', 'MVP seed'),
  ('iron', 'male', 19, 150, 8, null, 45, 'mg', 'MVP seed'),
  ('iron', 'female', 19, 50, 18, null, 45, 'mg', 'MVP seed'),
  ('iron', 'female', 51, 150, 8, null, 45, 'mg', 'MVP seed'),
  ('omega3', 'any', 19, 150, null, 1100, null, 'mg', 'MVP seed');

insert into public.interaction_rules (nutrient_id, medication_keyword, condition_code, severity, message, source_note) values
  ('vitamin_k', 'warfarin', null, 'high', '와파린 계열 약 복용 중에는 비타민 K 섭취 변동을 전문가와 확인하세요.', 'MVP rule'),
  ('omega3', 'warfarin', null, 'caution', '항응고제 복용 중 고용량 오메가3는 출혈 위험 상담이 필요할 수 있습니다.', 'MVP rule'),
  ('calcium', 'levothyroxine', null, 'caution', '갑상선 호르몬제와 칼슘은 복용 간격을 확인하는 것이 좋습니다.', 'MVP rule'),
  ('iron', 'levothyroxine', null, 'caution', '갑상선 호르몬제와 철분은 흡수 간섭 가능성이 있어 복용 간격 확인이 필요합니다.', 'MVP rule'),
  ('magnesium', null, 'kidney', 'high', '신장 질환이 있으면 마그네슘 보충제 복용 전 전문가 상담이 필요합니다.', 'MVP rule');
