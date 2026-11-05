-- ============================================================
-- Patient app active indicator: per-patient status + per-org
-- feature flag to show/hide the indicator in the P360 banner
-- and All Patients table.
-- ============================================================

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS show_patient_app_indicator BOOLEAN DEFAULT false;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS patient_app_active BOOLEAN DEFAULT false;

ALTER TABLE all_patients
  ADD COLUMN IF NOT EXISTS patient_app_active BOOLEAN DEFAULT false;

-- Demo backfill: ~2/3 of patients marked active on the patient app.
UPDATE patients
SET patient_app_active = (('x' || substr(md5(id), 1, 8))::bit(32)::int % 3) <> 0;

UPDATE all_patients
SET patient_app_active = (('x' || substr(md5(id), 1, 8))::bit(32)::int % 3) <> 0;
