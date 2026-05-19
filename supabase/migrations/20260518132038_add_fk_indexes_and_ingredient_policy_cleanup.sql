create index if not exists user_conditions_user_id_idx on public.user_conditions (user_id);
create index if not exists user_medications_user_id_idx on public.user_medications (user_id);
create index if not exists nutrient_reference_values_nutrient_id_idx on public.nutrient_reference_values (nutrient_id);
create index if not exists interaction_rules_nutrient_id_idx on public.interaction_rules (nutrient_id);
create index if not exists supplement_products_owner_user_id_idx on public.supplement_products (owner_user_id);
create index if not exists supplement_ingredients_product_id_idx on public.supplement_ingredients (product_id);
create index if not exists supplement_ingredients_nutrient_id_idx on public.supplement_ingredients (nutrient_id);
create index if not exists user_supplements_user_id_idx on public.user_supplements (user_id);
create index if not exists user_supplements_product_id_idx on public.user_supplements (product_id);
create index if not exists label_parse_jobs_user_id_idx on public.label_parse_jobs (user_id);
create index if not exists analysis_reports_user_id_idx on public.analysis_reports (user_id);

drop policy if exists "ingredients writable through own product" on public.supplement_ingredients;

create policy "own ingredients insert" on public.supplement_ingredients
  for insert to authenticated
  with check (
    exists (
      select 1 from public.supplement_products products
      where products.id = supplement_ingredients.product_id
        and products.owner_user_id = (select auth.uid())
    )
  );

create policy "own ingredients update" on public.supplement_ingredients
  for update to authenticated
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

create policy "own ingredients delete" on public.supplement_ingredients
  for delete to authenticated
  using (
    exists (
      select 1 from public.supplement_products products
      where products.id = supplement_ingredients.product_id
        and products.owner_user_id = (select auth.uid())
    )
  );
