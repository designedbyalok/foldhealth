-- Care Plan Library: templates, goals, barriers and a goal's interventions.
--
-- THE HOLE THIS CLOSES
-- Settings → Care Plan Library built its three tabs entirely out of component
-- state (`useState([])` in CarePlanLibraryPanel). Everything a user created,
-- a goal with its measure, target and chronic conditions, a barrier, a plan
-- template: lived for exactly as long as the tab stayed mounted. Switching
-- to another settings section unmounted the panel and silently threw the work
-- away; a reload did the same. Interventions were worse: the Send Form / Send
-- Patient Education / Measure Vital drawers collected a full configuration and
-- then dropped it on Save, because there was nowhere to put it.
--
-- WHAT THIS DOES
--   1. `care_plan_goals`, one row per library goal. The goal-creation drawer
--      is a wizard over a single measurement, so its fields map 1:1 rather
--      than into a blob: category + measure pick the shape, comparator and
--      target_value / target_value_2 carry the target, and duration_unit is
--      kept beside duration because "3" and "Month" are edited separately.
--      `set_target` is stored because "no target" is a real, chosen state,
--      distinct from a target the user has not filled in yet.
--   2. `care_plan_barriers`, title + description today. It gets its own table
--      rather than a `kind` column on goals because the two diverge fast:
--      barriers have no measure, no target and no schedule.
--   3. `care_plan_templates`, a named plan. Its goal / intervention rows are
--      jsonb: inside a template they are ordered, free-text line items the
--      author types, not references to library rows, so a join table would
--      model a relationship that does not exist.
--   4. `care_plan_interventions`, the rows behind a goal's Linked Items. One
--      table with `kind` + `config` jsonb instead of four near-identical
--      tables: every intervention kind shares title / creation-trigger / due
--      offset / duration type, and differs only in which entity it points at
--      (a form, an education item, a vital). ON DELETE CASCADE because an
--      intervention has no meaning without its goal.
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon`.
-- This is staff-only configuration data behind the Settings area, there is no
-- ownership column to scope it by, and every signed-in staff member edits the
-- same library.

CREATE TABLE IF NOT EXISTS public.care_plan_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  category      text,
  measure       text,
  conditions    text[] NOT NULL DEFAULT '{}',
  comparator    text,
  target_value  text,
  target_value_2 text,
  custom_unit   text,
  set_target    boolean NOT NULL DEFAULT true,
  duration      text,
  duration_unit text,
  frequency     text,
  target_date   text,
  priority      text,
  created_by    text,
  updated_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_plan_barriers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  created_by   text,
  updated_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_plan_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  conditions     text[] NOT NULL DEFAULT '{}',
  goals          jsonb NOT NULL DEFAULT '[]'::jsonb,
  interventions  jsonb NOT NULL DEFAULT '[]'::jsonb,
  barriers       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by     text,
  updated_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_plan_interventions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid NOT NULL REFERENCES public.care_plan_goals(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL DEFAULT '',
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_plan_interventions_goal_id_idx
  ON public.care_plan_interventions (goal_id);

ALTER TABLE public.care_plan_goals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_barriers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_interventions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'care_plan_goals', 'care_plan_barriers', 'care_plan_templates', 'care_plan_interventions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Staff manage %1$s" ON public.%1$I FOR ALL TO authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',
      t);
  END LOOP;
END $$;

-- Authorship, added after the first cut of this file. Written as separate
-- ALTERs so a database that already ran the CREATEs above picks them up.
ALTER TABLE public.care_plan_goals     ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.care_plan_barriers  ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.care_plan_templates ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.care_plan_goals     ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE public.care_plan_barriers  ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE public.care_plan_templates ADD COLUMN IF NOT EXISTS updated_by text;

-- A template carries barriers as well as goals and interventions: the three
-- GBI sections a care plan is made of. Same jsonb treatment as `goals`, the
-- entries reference library rows by id but are ordered, plan-local copies.
ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS barriers jsonb NOT NULL DEFAULT '[]'::jsonb;
