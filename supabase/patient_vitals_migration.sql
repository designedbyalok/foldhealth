-- Vitals recorded from the patient profile's Record Vitals drawer.
-- One row per vital per recording. Two-part vitals keep their second
-- number in value2 (Blood Pressure diastolic, Height inches).
CREATE TABLE IF NOT EXISTS patient_vitals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  text NOT NULL,
  vital_key   text NOT NULL,
  value       text NOT NULL,
  value2      text,
  flag        boolean NOT NULL DEFAULT false,
  recorded_on date NOT NULL,
  recorded_by text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_vitals_patient_id_idx ON patient_vitals (patient_id, recorded_on DESC);
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_vitals" ON patient_vitals;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Allow all on patient_vitals" ON patient_vitals FOR ALL TO authenticated USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
