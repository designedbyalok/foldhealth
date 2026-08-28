-- Patient Care Plan — the per-patient, per-program Goals & Interventions that
-- the Care Plan step renders.
--
-- THE HOLE THIS CLOSES
-- The patient-facing Care Plan step (CarePlanView) rendered entirely from a
-- static import (src/features/patient/data/carePlanMock.js). Every goal, its
-- status, every intervention — all hard-coded. Nothing a user did there could
-- persist, and there was no way to show a different plan per patient/program.
-- Meanwhile Settings → Care Plan Library already had real, Supabase-backed
-- goals/interventions/templates (care_plan_* tables) but nothing connected the
-- two: a library template could not be instantiated against a patient.
--
-- WHAT THIS DOES
--   1. patient_care_plans — one header row per (patient, program). Holds the
--      plan's identity: who created it, the chronic-condition chips shown at
--      the top, and the total-conditions count. `program_id` is the runtime
--      text id the store mints for an enrollment (`pcp-<patient>-<code>`), not
--      a uuid, so it is stored as text. UNIQUE (patient_id, program_id) makes
--      "the plan for this program" a single, upsertable row.
--   2. patient_care_plan_goals — one row per goal on a plan. Columns mirror
--      care_plan_goals (so a library goal maps in 1:1) plus the fields the
--      patient view shows and edits: current_value, trend, status, and the
--      subtitle/icon the row renders. sort_order keeps the author's ordering.
--   3. patient_care_plan_interventions — one row per intervention. goal_id is
--      NULLABLE: the patient view lists interventions in their own section, not
--      strictly nested under a goal, so an intervention belongs to the plan and
--      MAY point at a goal. ON DELETE SET NULL keeps an intervention alive if
--      its goal is removed; the plan cascade still cleans it up.
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon`.
-- This is staff clinical data behind the signed-in app; every staff member
-- works the same patients, so there is no per-row ownership to scope by.

CREATE TABLE IF NOT EXISTS public.patient_care_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      text NOT NULL,
  program_id      text NOT NULL,
  program_code    text,
  created_by      text,
  conditions      text[] NOT NULL DEFAULT '{}',
  condition_total integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, program_id)
);

CREATE TABLE IF NOT EXISTS public.patient_care_plan_goals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        uuid NOT NULL REFERENCES public.patient_care_plans(id) ON DELETE CASCADE,
  title          text NOT NULL,
  subtitle       text NOT NULL DEFAULT '',
  icon           text,
  priority       text NOT NULL DEFAULT 'medium',
  category       text,
  measure        text,
  conditions     text[] NOT NULL DEFAULT '{}',
  comparator     text,
  target_value   text,
  target_value_2 text,
  custom_unit    text,
  set_target     boolean NOT NULL DEFAULT true,
  duration       text,
  duration_unit  text,
  frequency      text,
  target_date    text,
  current_value  text,
  trend          text,
  status         text NOT NULL DEFAULT 'Not Started',
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_care_plan_interventions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id            uuid NOT NULL REFERENCES public.patient_care_plans(id) ON DELETE CASCADE,
  goal_id            uuid REFERENCES public.patient_care_plan_goals(id) ON DELETE SET NULL,
  kind               text,
  title              text NOT NULL DEFAULT '',
  icon               text,
  duration           text,
  config             jsonb NOT NULL DEFAULT '{}'::jsonb,
  assignee_name      text,
  assignee_initials  text,
  status             text NOT NULL DEFAULT 'Not Started',
  adherence          text,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_care_plans_patient_idx
  ON public.patient_care_plans (patient_id);
CREATE INDEX IF NOT EXISTS patient_care_plan_goals_plan_idx
  ON public.patient_care_plan_goals (plan_id);
CREATE INDEX IF NOT EXISTS patient_care_plan_interventions_plan_idx
  ON public.patient_care_plan_interventions (plan_id);

ALTER TABLE public.patient_care_plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_care_plan_goals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_care_plan_interventions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patient_care_plans', 'patient_care_plan_goals', 'patient_care_plan_interventions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Staff manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t);
  END LOOP;
END $$;
