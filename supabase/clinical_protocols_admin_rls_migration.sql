-- Clinical protocols: only practice admins edit, approve, retire or delete.
--
-- Any staff user can still upload a protocol: the upload inserts a
-- 'processing' row and the uploader's browser writes the parse result back
-- as a 'draft' (or 'failed'). Everything after that (review edits, Approve,
-- Parse Again, Retire, Delete) is admin only. Fold's own protocols
-- (source_kind 'fold') are written only by the seed, which runs without a
-- JWT and so bypasses RLS.
--
-- "Admin" is the same test as Access Control and the Users tab:
-- public.is_profile_admin (admin_role Admin/Practice Manager or
-- Business/Practice Owner, or the Admin/Practice Manager clinical role, and
-- an Active profile). It isn't granted to `authenticated`, so the policies
-- call this wrapper, which only answers for the caller.
--
-- Additive and idempotent. Replaces the open policies from
-- clinical_protocols_migration.sql.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_profile_admin(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

DROP POLICY IF EXISTS "insert clinical protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "update clinical protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "update clinical protocols (admin)" ON public.clinical_protocols;
DROP POLICY IF EXISTS "update clinical protocols (upload parse)" ON public.clinical_protocols;
DROP POLICY IF EXISTS "delete clinical protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "delete clinical protocols (admin)" ON public.clinical_protocols;

-- Uploads start unapproved and processing.
CREATE POLICY "insert clinical protocols" ON public.clinical_protocols
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'processing'
    AND approved_by IS NULL AND approved_at IS NULL
    AND source_kind IS DISTINCT FROM 'fold'
  );

-- The upload's own parse step: processing becomes draft or failed, unapproved.
CREATE POLICY "update clinical protocols (upload parse)" ON public.clinical_protocols
  FOR UPDATE TO authenticated
  USING (status = 'processing' AND source_kind IS DISTINCT FROM 'fold')
  WITH CHECK (
    status IN ('processing', 'draft', 'failed')
    AND approved_by IS NULL AND approved_at IS NULL
    AND source_kind IS DISTINCT FROM 'fold'
  );

CREATE POLICY "update clinical protocols (admin)" ON public.clinical_protocols
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin() AND source_kind IS DISTINCT FROM 'fold')
  WITH CHECK (public.current_user_is_admin() AND source_kind IS DISTINCT FROM 'fold');

CREATE POLICY "delete clinical protocols (admin)" ON public.clinical_protocols
  FOR DELETE TO authenticated
  USING (public.current_user_is_admin() AND source_kind IS DISTINCT FROM 'fold');

-- Deleting a protocol also removes its file; only admins delete.
DROP POLICY IF EXISTS "clinical-protocols delete" ON storage.objects;
CREATE POLICY "clinical-protocols delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clinical-protocols' AND public.current_user_is_admin());

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- Re-run the policy block of clinical_protocols_migration.sql, then:
-- DROP POLICY IF EXISTS "update clinical protocols (admin)" ON public.clinical_protocols;
-- DROP POLICY IF EXISTS "update clinical protocols (upload parse)" ON public.clinical_protocols;
-- DROP POLICY IF EXISTS "delete clinical protocols (admin)" ON public.clinical_protocols;
