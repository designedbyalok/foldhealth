-- Referrals shown in the patient profile's Orders & Referrals tab
-- (Referral view). One row per referral; attachments is a JSON array of
-- { name, type, url, storagePath? }.
CREATE TABLE IF NOT EXISTS patient_referrals (
  id                    text PRIMARY KEY,
  patient_id            text NOT NULL,
  referred_by_name      text NOT NULL,
  referred_by_specialty text,
  referred_to_name      text NOT NULL,
  referred_to_specialty text,
  status                text NOT NULL DEFAULT 'Draft',
  reason                text,
  note                  text,
  attachments           jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_referrals_patient_id_idx ON patient_referrals (patient_id, created_at DESC);
ALTER TABLE patient_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_referrals" ON patient_referrals;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Allow all on patient_referrals" ON patient_referrals FOR ALL TO authenticated USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
-- New Referral drawer (Orders & Referrals > New Order > Referral).
ALTER TABLE patient_referrals ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Routine';
