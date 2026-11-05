-- Patient Care Plan Barriers: per-patient, per-program barrier instances.
--
-- WHY: Settings → Care Plan Library already has staff-managed `care_plan_barriers`
-- but the patient-facing Care Plan step (`CarePlanView`) only rendered Goals
-- and Interventions. Barriers were entirely static (no table, no store, no UI)
-- so a care manager could not record that "Transportation" or "Health
-- Literacy" blocks a goal for this patient, nor could those barriers persist.
--
-- WHAT:
--   patient_care_plan_barriers: one row per barrier on a plan. Mirrors the
--   library shape (title, description) plus the patient-view fields:
--   status (Not Started / In Progress / Resolved …), priority, and sort_order.
--   goal_id is optional: a barrier may block a specific goal or be plan-wide.
--   ON DELETE SET NULL keeps the barrier if its goal is removed; plan cascade
--   still cleans up.
--
-- RLS: authenticated full access (staff clinical data, same as plan/goals/interventions).

CREATE TABLE IF NOT EXISTS public.patient_care_plan_barriers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.patient_care_plans(id) ON DELETE CASCADE,
  goal_id     uuid REFERENCES public.patient_care_plan_goals(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'Not Started',
  priority    text NOT NULL DEFAULT 'medium',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_care_plan_barriers_plan_idx
  ON public.patient_care_plan_barriers (plan_id);

CREATE INDEX IF NOT EXISTS patient_care_plan_barriers_goal_idx
  ON public.patient_care_plan_barriers (goal_id);

ALTER TABLE public.patient_care_plan_barriers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_care_plan_barriers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Staff manage %1$s" ON public.%1$I FOR ALL TO authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',
      t);
  END LOOP;
END $$;
