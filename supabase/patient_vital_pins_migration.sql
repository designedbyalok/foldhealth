-- Rows pinned to the top of the patient's Vitals/Labs tables (Vitals, Biomarkers,
-- Labs...). One row per patient; `pinned` holds the row ids (e.g. 'bp', 'hba1c').
-- No row yet means the app's default pins.
CREATE TABLE IF NOT EXISTS patient_vital_pins (
  patient_id  text PRIMARY KEY,
  pinned      text[] NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patient_vital_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_vital_pins" ON patient_vital_pins;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Allow all on patient_vital_pins" ON patient_vital_pins FOR ALL TO authenticated USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
