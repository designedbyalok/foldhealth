-- Employer Impact Report: cover images people add in the Print drawer.
--
-- The drawer's cover gallery shows the built-in artwork (bundled with the
-- app) plus the images added for that employer. Each added image is a file in
-- the `report-covers` bucket and a row here, keyed by employer (the report's
-- Employer filter; 'all' when none is picked), so everyone exporting that
-- employer's report sees the same gallery.
--
-- The bucket is public-read so the in-browser PDF builder can fetch a cover
-- without an auth header; paths are random UUIDs and covers carry no patient
-- data. Only signed-in users can upload or delete, and only images up to 5 MB.

-- ── Bucket ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-covers', 'report-covers', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "report-covers upload" ON storage.objects;
CREATE POLICY "report-covers upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-covers');

-- Storage's remove() reads the object row before deleting it, so deleting
-- needs SELECT too. (Viewing covers doesn't: the bucket is public.)
DROP POLICY IF EXISTS "report-covers read" ON storage.objects;
CREATE POLICY "report-covers read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'report-covers');

DROP POLICY IF EXISTS "report-covers delete" ON storage.objects;
CREATE POLICY "report-covers delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'report-covers');

-- ── Gallery rows ──
CREATE TABLE IF NOT EXISTS public.employer_report_covers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer      text NOT NULL,
  name          text NOT NULL,
  storage_path  text NOT NULL,
  public_url    text NOT NULL,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employer_report_covers_employer_idx
  ON public.employer_report_covers (employer, created_at DESC);

ALTER TABLE public.employer_report_covers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on employer_report_covers" ON public.employer_report_covers;
CREATE POLICY "Allow all on employer_report_covers" ON public.employer_report_covers
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

-- Rollback:
--   DROP TABLE IF EXISTS public.employer_report_covers;
--   DROP POLICY IF EXISTS "report-covers upload" ON storage.objects;
--   DROP POLICY IF EXISTS "report-covers delete" ON storage.objects;
--   DROP POLICY IF EXISTS "report-covers read" ON storage.objects;
--   -- empty the bucket in the dashboard, then: DELETE FROM storage.buckets WHERE id = 'report-covers';
