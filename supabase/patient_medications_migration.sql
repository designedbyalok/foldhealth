-- Patient medications — backs the Medication Reconciliation step under
-- Care Programs → Program Detail. New meds picked from OpenFDA (or entered
-- manually) land here; the initial list was carried in MED_RECON_MOCK, which
-- this migration copies into rows keyed to patient p1 (Ralph Halvorson) so
-- the pre-migration demo view stays intact.
--
-- Design notes
--   • `openfda_meta` keeps the raw NDC record (brand, generic, dosage form,
--     route, strength) so downstream flows (e.g. rendering brand-vs-generic
--     alt names) don't have to re-query. It's optional; manual entries land
--     with a NULL meta.
--   • `source` distinguishes provenance so a discharge-report importer, a
--     manual entry, and an OpenFDA pick don't get mixed up in reports.

BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_medications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Plain grouping key, not a FK. A patient can be sourced from any of the
  -- worklist slices (hcc_members, awv_members, ccm_worklist_members, snp,
  -- patients) — each with its own id shape — and Medication Reconciliation
  -- needs to persist for all of them. See patient_medications_drop_fk_migration.sql.
  patient_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  start_date   TEXT,                             -- MM/DD/YYYY to match the rest of the UI
  stop_date    TEXT,
  sig          TEXT,
  source       TEXT NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('manual','openfda','discharge_import')),
  openfda_meta JSONB,                             -- raw NDC row when source='openfda'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id
  ON public.patient_medications (patient_id);

ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;

-- This is PHI — a patient's medication list. Reads are open to any signed-in
-- staff member (whoever is looking at the patient), but writes require an
-- active staff profile. `FOR ALL USING (true)` let any authenticated session
-- add, alter or delete medications for any patient, including an `Invited`
-- account that had never been activated. Same shape as
-- program_documents_migration.sql.
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.patient_medications;

DROP POLICY IF EXISTS patient_medications_select ON public.patient_medications;
CREATE POLICY patient_medications_select
  ON public.patient_medications FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS patient_medications_insert ON public.patient_medications;
CREATE POLICY patient_medications_insert
  ON public.patient_medications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

DROP POLICY IF EXISTS patient_medications_update ON public.patient_medications;
CREATE POLICY patient_medications_update
  ON public.patient_medications FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

DROP POLICY IF EXISTS patient_medications_delete ON public.patient_medications;
CREATE POLICY patient_medications_delete
  ON public.patient_medications FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

-- Seed: mirror MED_RECON_MOCK.medications for Ralph Halvorson (p1). Fixed
-- UUIDs so re-running the migration is idempotent (nothing depends on these
-- ids externally; the ON CONFLICT keeps the rows stable across replays).
INSERT INTO public.patient_medications (id, patient_id, name, start_date, stop_date, sig, source)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'p1', 'Atorvastatin (Lipitor) 40mg',        '11/09/2024', '01/30/2025', '1 tab • 1 time a day • Any Time',   'manual'),
  ('11111111-0000-0000-0000-000000000002', 'p1', 'Amlodipine (Norvasc) 5mg',           '05/05/2024', '09/12/2025', '1 tab • 1 time a day • Any Time',   'manual'),
  ('11111111-0000-0000-0000-000000000003', 'p1', 'Escitalopram (Lexapro) 10mg',        '02/28/2024', '06/18/2025', '1 tab • 1 time a day • Evening',    'manual'),
  ('11111111-0000-0000-0000-000000000004', 'p1', 'Metoprolol (Lopressor) 25mg',        '10/04/2024', '04/11/2024', '1 tab • 2 times a day • After Meal','manual'),
  ('11111111-0000-0000-0000-000000000005', 'p1', 'Omeprazole (Prilosec) 20mg',         '08/21/2024', '12/30/2024', '1 tab • 1 time a day • Before Meal','manual'),
  ('11111111-0000-0000-0000-000000000006', 'p1', 'Levothyroxine (Synthroid) 100mcg',   '01/15/2024', '03/22/2024', '1 tab • 1 time a day • Before Meal','manual'),
  ('11111111-0000-0000-0000-000000000007', 'p1', 'Gabapentin (Neurontin) 300mg',       '07/07/2024', '11/11/2024', '1 tab • 3 times a day • Any Time',  'manual'),
  ('11111111-0000-0000-0000-000000000008', 'p1', 'Hydrochlorothiazide (Microzide) 25mg','02/14/2023','06/30/2023', '1 tab • 1 time a day • Morning',    'manual')
ON CONFLICT (id) DO NOTHING;

COMMIT;
