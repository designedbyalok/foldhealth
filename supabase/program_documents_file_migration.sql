-- Adds file-storage columns to program_documents so an uploaded document's
-- bytes are retrievable across sessions (previously only metadata was
-- persisted, so image/PDF previews only worked for the session that
-- uploaded them). Mirrors the hcc_added_charts pdf_url/storage_path pattern.

ALTER TABLE program_documents
  ADD COLUMN IF NOT EXISTS file_url     TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS ext          TEXT;

-- ── Storage bucket (manual step: no migration in this repo creates buckets;
--    `chart-uploads` was set up the same way) ──────────────────────────────
-- In the Supabase dashboard, create a bucket named `program-documents`:
--   - Public: on (so getPublicUrl() links resolve without a signed URL)
--   - Mirror chart-uploads' storage.objects RLS policies for this bucket
--     (authenticated read/write, scoped the same way as the table policies
--     below) so uploads from the app succeed.

-- ── Verify ────────────────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--    where table_name = 'program_documents' and column_name in ('file_url','storage_path','ext');
--   Expect all three.

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table program_documents drop column if exists file_url;
--   alter table program_documents drop column if exists storage_path;
--   alter table program_documents drop column if exists ext;
