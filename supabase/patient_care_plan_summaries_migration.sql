-- Care Plan AI summary — the cross-program recap the Comprehensive Care Plan
-- generates on demand ("Summarize active programs").
--
-- THE HOLE THIS CLOSES
-- The recap was held only in component state, so it vanished on reload or when
-- the reader left the tab, and every visit meant regenerating (another Gemini
-- call). It is a per-patient artifact, so it lives in one row per patient and a
-- fresh generation overwrites the previous one.
--
-- WHAT THIS DOES
--   patient_care_plan_summaries — one row per patient. `summary` is the
--   { intro, points, actions } object the /api/care-plan-summary proxy returns.
--   patient_id is the primary key so the app can upsert (generate = overwrite).
--   generated_by / generated_at record who produced the current recap and when.
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon` —
-- consistent with the other care-plan tables. The app scopes by patient_id.

CREATE TABLE IF NOT EXISTS public.patient_care_plan_summaries (
  patient_id   text PRIMARY KEY,
  summary      jsonb NOT NULL,
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_care_plan_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage patient_care_plan_summaries" ON public.patient_care_plan_summaries;
CREATE POLICY "Staff manage patient_care_plan_summaries"
  ON public.patient_care_plan_summaries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
