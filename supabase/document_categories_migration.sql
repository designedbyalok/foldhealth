-- Custom folders for the patient Documents tab (Add Category). Shared across
-- patients; a document's program_documents.category holds the folder's key.
CREATE TABLE IF NOT EXISTS document_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  name        text NOT NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on document_categories" ON document_categories;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Allow all on document_categories" ON document_categories FOR ALL TO authenticated USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
