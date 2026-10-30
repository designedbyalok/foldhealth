-- Care Plan AI summary for one program's care plan: the same recap the
-- Comprehensive Care Plan generates (patient_care_plan_summaries), scoped to a
-- single program. One row per patient + program; generating again overwrites
-- it, dismissing deletes it, so a summary stays until someone asks for a new
-- one. `summary` is the { intro, points, actions } object the
-- /api/care-plan-summary proxy returns.
--
-- RLS: on, open to signed-in staff, closed to anon, like the other care plan
-- tables. Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.patient_care_plan_program_summaries (
  patient_id   text NOT NULL,
  program_id   text NOT NULL,
  summary      jsonb NOT NULL,
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, program_id)
);

ALTER TABLE public.patient_care_plan_program_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage patient_care_plan_program_summaries" ON public.patient_care_plan_program_summaries;
CREATE POLICY "Staff manage patient_care_plan_program_summaries"
  ON public.patient_care_plan_program_summaries
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

-- ── Rollback ──────────────────────────────────────────────────────────────
--   drop table if exists public.patient_care_plan_program_summaries;
