revoke all on table
  public.user_profiles,
  public.user_conditions,
  public.user_medications,
  public.supplement_products,
  public.supplement_ingredients,
  public.user_supplements,
  public.label_parse_jobs,
  public.analysis_reports,
  public.nutrients,
  public.nutrient_reference_values,
  public.interaction_rules
from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on table
  public.nutrients,
  public.nutrient_reference_values
to anon, authenticated;

grant select on table
  public.interaction_rules
to authenticated;

grant select, insert, update on table
  public.user_profiles
to authenticated;

grant select, insert, update, delete on table
  public.user_conditions,
  public.user_medications,
  public.supplement_products,
  public.supplement_ingredients,
  public.user_supplements
to authenticated;

grant select, insert on table
  public.label_parse_jobs,
  public.analysis_reports
to authenticated;
