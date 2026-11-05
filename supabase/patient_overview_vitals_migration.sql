-- The vitals and biomarkers on a patient's Overview Vitals widget, in the
-- order the care team arranged them. One row per patient, shared by everyone
-- who opens the chart; `vital_keys` holds keys like 'bp', 'a1c', 'ldl'.
-- No row means the widget shows the patient's overview vitals.
CREATE TABLE IF NOT EXISTS patient_overview_vitals (
  patient_id  text PRIMARY KEY,
  vital_keys  text[] NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patient_overview_vitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in staff on patient_overview_vitals" ON patient_overview_vitals;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Signed-in staff on patient_overview_vitals" ON patient_overview_vitals
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

-- Seed: Annette Brave's chart (patient 11089) adds LDL after
-- her overview vitals. Readings come from the Vitals/Labs tab's history.
INSERT INTO patient_overview_vitals (patient_id, vital_keys)
VALUES ('11089', ARRAY['bp', 'a1c', 'glucose', 'bmi', 'ldl'])
ON CONFLICT (patient_id) DO NOTHING;
