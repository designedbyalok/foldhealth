-- Care Plan audit — an append-only trail of everything that happens to a
-- patient's care plan: goal/intervention created, edited, status-changed,
-- removed, and each share (roadmap #9). Feeds the History timeline.
--
-- THE HOLE THIS CLOSES
-- Care plan changes left no trace. A goal's status could flip, a goal could be
-- removed, the plan could be shared to the EHR — and none of it was recoverable
-- or visible after the fact. Clinical care plans need a change trail; this is
-- that trail, at the program level (and, unioned across programs, the patient
-- level).
--
-- WHAT THIS DOES
--   care_plan_audit — one immutable row per event. entity_type + entity_id say
--   what changed (a goal / intervention / share / the plan); action says how
--   (created / updated / status_changed / deleted / shared); summary is the
--   human line (usually the title) and detail carries the specifics (e.g.
--   "Not Started -> Met"). No updates or deletes are expected — it is a log.
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon`.

CREATE TABLE IF NOT EXISTS public.care_plan_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   text NOT NULL,
  program_id   text NOT NULL,
  program_code text,
  entity_type  text NOT NULL,
  entity_id    text,
  action       text NOT NULL,
  summary      text NOT NULL DEFAULT '',
  detail       text NOT NULL DEFAULT '',
  actor        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_plan_audit_patient_idx ON public.care_plan_audit (patient_id);
CREATE INDEX IF NOT EXISTS care_plan_audit_program_idx ON public.care_plan_audit (program_id);
CREATE INDEX IF NOT EXISTS care_plan_audit_created_idx ON public.care_plan_audit (created_at DESC);

ALTER TABLE public.care_plan_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage care_plan_audit" ON public.care_plan_audit;
CREATE POLICY "Staff manage care_plan_audit"
  ON public.care_plan_audit
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
