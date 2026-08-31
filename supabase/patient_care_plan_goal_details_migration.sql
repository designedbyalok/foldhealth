-- Patient Care Plan — Goal Details drawer (Figma SNP-Story "Goal Details").
--
-- WHY: The goal row's preview drawer is being expanded into the full "Goal
-- Details" panel — progress, a manual measurement history ("Last 5 Values"),
-- and per-goal automations. Two of those (measurement history, automations)
-- have no home in the existing patient_care_plan_* tables, and goals had no
-- progress column. This migration closes that gap. Everything is manual +
-- persisted: a care manager sets progress on the slider and enters readings by
-- hand; nothing is derived from vitals.
--
-- WHAT:
--   1. patient_care_plan_goals gains `progress` (0-100) and `updated_by` (the
--      staff name shown in the "Last Update … by <name>" meta line).
--   2. patient_care_plan_goal_measurements — one row per recorded value on a
--      goal (e.g. "145/90"). `favorable` drives the green/red colour in the
--      table; `taken_at` drives the relative "1mo / 18d / 7d" label and the
--      sparkline order. Cascades with its goal.
--   3. patient_care_plan_automations — one row per automation on the plan.
--      goal_id is optional (an automation may target a goal or the whole plan),
--      ON DELETE SET NULL keeps it if the goal is removed.
--
-- RLS: authenticated full access (staff clinical data, same posture as the rest
-- of the patient_care_plan_* tables).

ALTER TABLE public.patient_care_plan_goals
  ADD COLUMN IF NOT EXISTS progress   integer NOT NULL DEFAULT 0;
ALTER TABLE public.patient_care_plan_goals
  ADD COLUMN IF NOT EXISTS updated_by text;

CREATE TABLE IF NOT EXISTS public.patient_care_plan_goal_measurements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    uuid NOT NULL REFERENCES public.patient_care_plan_goals(id) ON DELETE CASCADE,
  value      text NOT NULL,
  unit       text NOT NULL DEFAULT '',
  favorable  boolean NOT NULL DEFAULT true,
  taken_at   timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_care_plan_automations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    uuid NOT NULL REFERENCES public.patient_care_plans(id) ON DELETE CASCADE,
  goal_id    uuid REFERENCES public.patient_care_plan_goals(id) ON DELETE SET NULL,
  title      text NOT NULL DEFAULT '',
  icon       text NOT NULL DEFAULT 'solar:bolt-linear',
  enabled    boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_care_plan_goal_measurements_goal_idx
  ON public.patient_care_plan_goal_measurements (goal_id);
CREATE INDEX IF NOT EXISTS patient_care_plan_automations_plan_idx
  ON public.patient_care_plan_automations (plan_id);
CREATE INDEX IF NOT EXISTS patient_care_plan_automations_goal_idx
  ON public.patient_care_plan_automations (goal_id);

ALTER TABLE public.patient_care_plan_goal_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_care_plan_automations        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patient_care_plan_goal_measurements', 'patient_care_plan_automations'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Staff manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t);
  END LOOP;
END $$;
