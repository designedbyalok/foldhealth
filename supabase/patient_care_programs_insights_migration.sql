-- Care Programs overview: the AI-written Why Prioritized and Program Summary.
--
-- The overview assembles both cards from the records. Unity can also write
-- them (POST /api/care-programs-insights), but only when someone clicks
-- Summarize, so the result is saved here and read back on every visit
-- instead of being generated each time the tab opens.
--
-- WHAT THIS DOES
--   patient_care_programs_insights: one row per patient.
--   `insights` is the { why: { takeaways, paragraph }, summary: { lead, points } }
--   object the API returns. `input_hash` fingerprints the facts it was written
--   from, so the app can tell when the records have moved on ("Records changed
--   since") without regenerating. Generating again overwrites the row;
--   dismissing deletes it.
--
-- RLS: on, open to signed-in staff, closed to anon, like the other care plan
-- summary tables. Additive and idempotent. No seed: rows are written by the
-- app when someone generates the cards.

CREATE TABLE IF NOT EXISTS public.patient_care_programs_insights (
  patient_id   text PRIMARY KEY,
  insights     jsonb NOT NULL,
  input_hash   text,
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_care_programs_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage patient_care_programs_insights" ON public.patient_care_programs_insights;
CREATE POLICY "Staff manage patient_care_programs_insights"
  ON public.patient_care_programs_insights
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

-- ── Rollback ──────────────────────────────────────────────────────────────
--   drop table if exists public.patient_care_programs_insights;
