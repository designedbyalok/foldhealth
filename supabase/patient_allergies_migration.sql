-- Patient allergy list: the allergies shown in the PAMI/Hx tab's "Allergies"
-- section and its Add Allergies drawer. One row per allergen per patient.
-- Read with the anon key, so RLS needs a permissive policy or the table
-- returns 0 rows and the section renders empty.

CREATE TABLE IF NOT EXISTS public.patient_allergies (
  id            text PRIMARY KEY,
  patient_id    text NOT NULL,
  title         text NOT NULL,          -- the allergen, e.g. "Egg Protein"
  code          text,                   -- RxNorm ingredient or SNOMED CT code
  code_system   text,                   -- the terminology the code belongs to
  reaction_type text,                   -- "Adverse Reaction" | "Allergy" | "Intolerance"
  criticality   text,                   -- "High" | "Low" | "Unable to Assess"
  since_date    text,                   -- display string, e.g. "03/18/2025"
  reactions     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ system, code, display, severity }]
  status        text NOT NULL DEFAULT 'Active',  -- "Active" | "Past"
  note          text NOT NULL DEFAULT '',
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_allergies_patient_id_idx
  ON public.patient_allergies (patient_id);

ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on patient_allergies" ON public.patient_allergies;
CREATE POLICY "Allow all on patient_allergies" ON public.patient_allergies
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
