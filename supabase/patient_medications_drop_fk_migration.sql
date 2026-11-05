-- Drop the FK from patient_medications.patient_id → patients.id.
--
-- The FK was overreach. `patient_medications.patient_id` is a plain grouping
-- key: a patient can appear in the app via the HCC / AWV / CCM / SNP
-- worklist slices, each of which has its own `id` shape (UUIDs, member
-- numbers, etc.) and its own source table. Requiring every med to reference
-- a row in `patients` fails as soon as a user opens Medication
-- Reconciliation for a patient sourced from any of the other worklists.
--
-- No data-loss risk from dropping the FK; the `patient_id` column stays in
-- place, the per-patient index stays, and the app already keys reads by
-- `patient_id` via `.eq(...)`.

BEGIN;

ALTER TABLE public.patient_medications
  DROP CONSTRAINT IF EXISTS patient_medications_patient_id_fkey;

COMMIT;
