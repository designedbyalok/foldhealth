-- Care Plan intervention templates — reusable, standalone interventions.
--
-- THE HOLE THIS CLOSES
-- Interventions only existed *inside* a goal: care_plan_interventions rows hang
-- off a goal_id, created one at a time in the goal drawer and thrown away as a
-- concept the moment you wanted the same "Measure BP daily" on another goal.
-- There was no library of interventions to browse or reuse (roadmap #27) and no
-- way to save an intervention as a reusable template (roadmap #32).
--
-- WHAT THIS DOES
--   care_plan_intervention_templates — one row per reusable intervention,
--   independent of any goal. `kind` is the same vocabulary the goal drawer's
--   Add-Intervention menu uses (send-form / patient-education / patient-task /
--   measure-vital / internal-task); `config` jsonb carries the kind-specific
--   payload, exactly like care_plan_interventions.config. It is a sibling of
--   the goals / barriers libraries, not a replacement for the goal-linked
--   care_plan_interventions rows (those stay the per-goal instances).
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon` —
-- staff-only library configuration, same as the other care_plan_* tables.

CREATE TABLE IF NOT EXISTS public.care_plan_intervention_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL DEFAULT 'internal-task',
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.care_plan_intervention_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage care_plan_intervention_templates" ON public.care_plan_intervention_templates;
CREATE POLICY "Staff manage care_plan_intervention_templates"
  ON public.care_plan_intervention_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
