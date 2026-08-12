-- ============================================================
-- All Patients — patient-data parity with the other worklists.
-- Every other worklist table carries these patient-data columns
-- (patients/ccm/hedis: dob; awv/ccm/hcc/hedis: ipa; ccm/hedis:
-- hp_code; hedis: zip) but all_patients was missing them, so the
-- profile banner showed "—" for DOB and the row tooltip had to
-- re-derive a DOB from age on every render.
-- ============================================================
--
-- dob is TEXT in MM/DD/YYYY for display parity with `patients`.
-- Idempotent; safe to re-run. Backfill lives in
-- scripts/seed_all_patients_demographics.js.

ALTER TABLE all_patients ADD COLUMN IF NOT EXISTS dob     TEXT;
ALTER TABLE all_patients ADD COLUMN IF NOT EXISTS ipa     TEXT;
ALTER TABLE all_patients ADD COLUMN IF NOT EXISTS hp_code TEXT;
ALTER TABLE all_patients ADD COLUMN IF NOT EXISTS zip     TEXT;
