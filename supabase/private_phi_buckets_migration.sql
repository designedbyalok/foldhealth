-- Make the patient-file Storage buckets private.
--
-- WHY
-- `chart-uploads` (HCC charts), `program-documents` (program / care gap
-- documents and referral attachments) and `chat-media` (staff chat and
-- patient chat attachments) hold PHI. They were public buckets, so every
-- file had a permanent getPublicUrl() link that anyone holding it could open
-- with no sign-in, forever. After this runs those links stop working: the
-- app signs each file on display (src/lib/storageUrl.js) with a 10-minute
-- signed URL, and the signed-out patient page asks /api/patient-media-url,
-- which signs only files posted in that patient's own chat.
--
-- Rows keep their stored public-format URLs; the app reads the bucket and
-- path out of them, so no data change is needed.
--
-- Signed-in users can read, upload, overwrite (uploads use upsert) and
-- delete, the same shape as program_documents_bucket_migration.sql. Any
-- older policy on these buckets for `anon` / `public` is dropped (the DO
-- block prints a NOTICE for each), since a SELECT policy for anon would let
-- anyone sign or download through the API even with the bucket private.
-- If a dropped policy also covered another bucket, re-create it for that
-- bucket alone.
--
-- No allowed_mime_types: uploads send file.type, which is empty or
-- application/octet-stream for some .csv / .tif / .doc files, and chat takes
-- any image or video, so a list would reject uploads that work today.
--
-- Idempotent. Ask Alok Kumar to run this migration on Supabase.

BEGIN;

UPDATE storage.buckets
   SET public = false
 WHERE id IN ('chart-uploads', 'program-documents', 'chat-media');

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND NOT (roles <@ ARRAY['authenticated', 'service_role']::name[])
       AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
           ~ '(chart-uploads|program-documents|chat-media)'
  LOOP
    RAISE NOTICE 'Dropping storage.objects policy "%" (granted beyond authenticated)', pol.policyname;
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

DO $$
DECLARE
  b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['chart-uploads', 'program-documents', 'chat-media'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' upload');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L)', b || ' upload', b);

    -- upsert: true overwrites an existing object, which needs UPDATE.
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' update');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L) WITH CHECK (bucket_id = %L)', b || ' update', b, b);

    -- createSignedUrl() and remove() both read the object row first.
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' read');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L)', b || ' read', b);

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' delete');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L)', b || ' delete', b);
  END LOOP;
END $$;

COMMIT;

-- ── Verify ──
--   -- all three rows show public = false:
--   SELECT id, public FROM storage.buckets
--    WHERE id IN ('chart-uploads', 'program-documents', 'chat-media');
--
--   -- only `authenticated` policies remain on these buckets (12 rows):
--   SELECT policyname, cmd, roles FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects'
--      AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
--          ~ '(chart-uploads|program-documents|chat-media)'
--    ORDER BY policyname;
--
--   -- a stored public URL now answers 400 "Bucket not found" (opened in a
--   -- browser), while the same file still shows in the app.

-- ── Rollback ──
--   UPDATE storage.buckets SET public = true
--    WHERE id IN ('chart-uploads', 'program-documents', 'chat-media');
--   (the authenticated policies can stay; dropped anon policies are listed
--   in the NOTICE output of the forward run)
