-- Fix goal units the plan could not show, in patient plans and the library.
--
-- The goal editor only shows a typed unit for "Others" goals. Elsewhere a
-- stored custom_unit is hidden: the target renders from the measure's
-- configured unit, or as a bare number when the measure has none.
--
-- 1. Goals with NO measure and a free-form unit ("≥ 5 days/week",
--    "≥ 8 cups/day", "≥ 90% scheduled labs completed") move to "Others",
--    the category for free-form targets, so the unit shows and is editable.
-- 2. custom_unit is cleared where the measure now has a configured unit that
--    means the same thing (goalFormat.js MEASURE_CONFIG). A "/day" unit is
--    only cleared when the goal's frequency is Daily, so "per day" is kept.
--
-- Assessment goals and goals without a target are left alone. Safe to
-- re-run. Roll back from care_plan_bak.

begin;

create schema if not exists care_plan_bak;

create temp table unit_equivalents (measure text, custom_unit text) on commit drop;
insert into unit_equivalents values
  ('Calories', 'cals'),
  ('Cycling', 'min/day'),
  ('Body Temperature', '°F'),
  ('Weight', 'lbs'),
  ('Water', 'oz/day'),
  ('Mediterranean Adherence', '%'),
  ('DASH Adherence', '%'),
  ('Sodium', 'mg/day'),
  ('Carbohydrates', 'g/day'),
  ('Protein', 'g/day'),
  ('Fiber', 'g/day'),
  ('Sugar', 'g/day'),
  ('Saturated Fat', 'g/day'),
  ('Fruits & Vegetables', 'servings/day');

-- ── Snapshots (rollback source) ────────────────────────────────────────
create table if not exists care_plan_bak.goal_units_patient as
select g.id, g.category, g.custom_unit, now() as snapshot_at
from public.patient_care_plan_goals g
where coalesce(g.custom_unit, '') <> ''
  and coalesce(g.category, '') in ('Diet', 'Labs', 'Exercise', 'Vitals');

create table if not exists care_plan_bak.goal_units_library as
select g.id, g.category, g.custom_unit, now() as snapshot_at
from public.care_plan_goals g
where coalesce(g.custom_unit, '') <> ''
  and coalesce(g.category, '') in ('Diet', 'Labs', 'Exercise', 'Vitals');

-- ── 1. No measure + free-form unit → Others ────────────────────────────
update public.patient_care_plan_goals
set category = 'Others'
where category in ('Diet', 'Labs')
  and coalesce(measure, '') = ''
  and coalesce(custom_unit, '') <> ''
  and coalesce(target_value, '') <> '';

update public.care_plan_goals
set category = 'Others'
where category in ('Diet', 'Labs')
  and coalesce(measure, '') = ''
  and coalesce(custom_unit, '') <> ''
  and coalesce(target_value, '') <> '';

-- ── 2. Clear units the configured measure unit already covers ──────────
update public.patient_care_plan_goals g
set custom_unit = ''
from unit_equivalents u
where g.measure = u.measure
  and g.custom_unit = u.custom_unit
  and coalesce(g.category, '') <> 'Others'
  and (u.custom_unit not like '%/day' or g.frequency = 'Daily');

update public.care_plan_goals g
set custom_unit = ''
from unit_equivalents u
where g.measure = u.measure
  and g.custom_unit = u.custom_unit
  and coalesce(g.category, '') <> 'Others'
  and (u.custom_unit not like '%/day' or g.frequency = 'Daily');

commit;

-- Rollback:
-- update public.patient_care_plan_goals g set category = s.category, custom_unit = s.custom_unit
--   from care_plan_bak.goal_units_patient s where s.id = g.id;
-- update public.care_plan_goals g set category = s.category, custom_unit = s.custom_unit
--   from care_plan_bak.goal_units_library s where s.id = g.id;
