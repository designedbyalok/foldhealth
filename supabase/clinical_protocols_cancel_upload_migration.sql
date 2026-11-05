-- Clinical protocols: a cancelled upload leaves nothing behind.
--
-- Any staff user can upload a protocol (clinical_protocols_admin_rls_migration.sql),
-- and the upload stays 'processing' while the browser parses it and builds
-- its scope. Cancelling it then removes the row and the stored file, but
-- deletes were admin only, so a non-admin's cancelled upload was left
-- behind. This lets the uploader's browser remove a row while it is still
-- 'processing', and its file while that row still exists (the file goes
-- first). Once parsed, a protocol is 'draft' and only an admin rejects or
-- deletes it, as before.
--
-- Additive and idempotent.

DROP POLICY IF EXISTS "delete clinical protocols (cancelled upload)" ON public.clinical_protocols;
CREATE POLICY "delete clinical protocols (cancelled upload)" ON public.clinical_protocols
  FOR DELETE TO authenticated
  USING (status = 'processing' AND source_kind IS DISTINCT FROM 'fold');

DROP POLICY IF EXISTS "clinical-protocols delete (cancelled upload)" ON storage.objects;
CREATE POLICY "clinical-protocols delete (cancelled upload)" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinical-protocols'
    AND EXISTS (
      SELECT 1 FROM public.clinical_protocols p
      WHERE p.id::text = split_part(name, '/', 1) AND p.status = 'processing'
    )
  );
