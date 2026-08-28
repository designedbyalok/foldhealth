-- Care Plan versioning & sign-off (roadmap #25, #36).
--
-- THE HOLE THIS CLOSES
-- A care plan had exactly one mutable state and no notion of being "signed".
-- There was no immutable snapshot to return to, no record of who signed what
-- when, and no way to add a maintenance note or change a status after sign-off
-- without editing the plan proper. This adds sign-off state to the plan and an
-- append-only version history it can be restored from.
--
-- WHAT THIS DOES
--   1. patient_care_plans gains signed_by / signed_at — the plan's sign-off
--      state. Null = draft; set = signed.
--   2. patient_care_plan_versions — one immutable snapshot per version. The
--      snapshot jsonb captures the full plan (conditions + goals +
--      interventions) at capture time, so a restore is a pure data replay and
--      doesn't depend on the live rows still existing. `reason` says why it was
--      taken (signed / manual / restore), and note carries the sign-off note.
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon`.

ALTER TABLE public.patient_care_plans ADD COLUMN IF NOT EXISTS signed_by text;
ALTER TABLE public.patient_care_plans ADD COLUMN IF NOT EXISTS signed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.patient_care_plan_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        uuid NOT NULL REFERENCES public.patient_care_plans(id) ON DELETE CASCADE,
  patient_id     text NOT NULL,
  program_id     text NOT NULL,
  version_number integer NOT NULL,
  snapshot       jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason         text NOT NULL DEFAULT 'manual',
  note           text NOT NULL DEFAULT '',
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version_number)
);

CREATE INDEX IF NOT EXISTS patient_care_plan_versions_plan_idx
  ON public.patient_care_plan_versions (plan_id);

ALTER TABLE public.patient_care_plan_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage patient_care_plan_versions" ON public.patient_care_plan_versions;
CREATE POLICY "Staff manage patient_care_plan_versions"
  ON public.patient_care_plan_versions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
