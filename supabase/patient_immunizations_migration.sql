-- Patient immunization list: the immunizations shown in the PAMI/Hx tab's
-- "Immunizations" section and its Add Immunizations drawer. One row per
-- administered vaccine per patient.
-- Read with the anon key, so RLS needs a permissive policy or the table
-- returns 0 rows and the section renders empty.

CREATE TABLE IF NOT EXISTS public.patient_immunizations (
  id               text PRIMARY KEY,
  patient_id       text NOT NULL,
  title            text NOT NULL,          -- the vaccine, e.g. "MMR"
  code             text,                   -- CVX code, e.g. "03"
  code_system      text,                   -- http://hl7.org/fhir/sid/cvx
  date_administered text,                  -- display string, e.g. "11/18/2023"
  dose_quantity    text,                   -- free text: "1", "0.5"
  dose_units       text,                   -- free text: "ml", "mcg"
  status           text NOT NULL DEFAULT 'Active',  -- "Active" | "Completed"
  note             text NOT NULL DEFAULT '',
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_immunizations_patient_id_idx
  ON public.patient_immunizations (patient_id);

ALTER TABLE public.patient_immunizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on patient_immunizations" ON public.patient_immunizations;
CREATE POLICY "Allow all on patient_immunizations" ON public.patient_immunizations
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
