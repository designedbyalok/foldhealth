-- Patient Documents tab (P360 right panel, Figma 238:47081).
--
-- The tab reads a patient's documents from program_documents: rows uploaded
-- from a care program step (program_code set) plus patient-level rows from the
-- Documents tab itself (program_code NULL). This adds the folder the tab files
-- each document under (imaging, lab, physical_therapy, health_assessment,
-- referral, report, form, personal_id, other). Rows without one are placed by
-- their `type` in the app.
--
-- Requires program_documents_migration.sql, program_documents_file_migration.sql
-- and program_documents_bucket_migration.sql (uploads go to the
-- `program-documents` bucket). RLS is unchanged: signed-in staff read, active
-- profiles write.
--
-- Idempotent. Ask Alok Kumar to run this migration, then `bun run seed` for
-- Annette Brave's (patient 11089) sample documents.

ALTER TABLE program_documents
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS program_documents_patient_idx
  ON program_documents (patient_id);

-- ── Verify ──
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'program_documents' AND column_name = 'category';
--   SELECT name, type, category FROM program_documents WHERE patient_id = '11089';

-- ── Rollback ──
--   DROP INDEX IF EXISTS program_documents_patient_idx;
--   ALTER TABLE program_documents DROP COLUMN IF EXISTS category;
