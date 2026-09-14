-- Patient problem list — the patient's medical conditions, shown in the PAMI/Hx
-- tab's "Problems" section and used to recommend condition-relevant goals in the
-- Add Goals drawer. One row per condition per patient. Read with the anon key,
-- so RLS needs a permissive policy or the table returns 0 rows and the UI falls
-- back to its local mock.

CREATE TABLE IF NOT EXISTS public.patient_problems (
  id           text PRIMARY KEY,
  patient_id   text NOT NULL,
  title        text NOT NULL,          -- e.g. "Diabetes Mellitus Type 2"
  code         text,                   -- ICD-10, e.g. "E11.9"
  problem_type text,                   -- "Chronic" | "Acute"
  severity     text,                   -- "Mild" | "Moderate" | "Severe"
  status       text NOT NULL DEFAULT 'Active',  -- "Active" | "Resolved"
  onset_label  text,                   -- display string, e.g. "11/18/23 (1 Year)"
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_problems_patient_id_idx ON public.patient_problems (patient_id);

ALTER TABLE public.patient_problems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on patient_problems" ON public.patient_problems;
CREATE POLICY "Allow all on patient_problems" ON public.patient_problems
  FOR ALL USING (true) WITH CHECK (true);
