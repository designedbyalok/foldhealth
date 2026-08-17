-- Dynamic population group rule builder.
--
-- 1) population_groups.rule — the react-querybuilder rule tree a Dynamic
--    group is defined by ({ combinator, rules: [...] }). NULL for Static
--    groups.
--
-- 2) Patient-profile columns the rule conditions read. The builder's field
--    catalog (src/features/population-groups/rule-builder/fieldCatalog.js)
--    maps every condition to a p360_profiles column; these are the ones that
--    did not exist yet. jsonb '[]' columns are record lists (a rule asks
--    "includes X"); text columns are single-valued statuses.
--
-- Both tables already exist with RLS enabled and authenticated policies, so
-- this only adds columns. Idempotent — safe to re-run.

ALTER TABLE public.population_groups
  ADD COLUMN IF NOT EXISTS rule jsonb;

ALTER TABLE public.p360_profiles
  ADD COLUMN IF NOT EXISTS problems               jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS diagnoses              jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS diagnosis_groups       jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS immunizations          jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS medication_orders      jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS procedures             jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS lab_results            jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS wearables              jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS forms_submitted        jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS membership_status      text,
  ADD COLUMN IF NOT EXISTS past_membership_status text,
  ADD COLUMN IF NOT EXISTS engagement_level       text;
