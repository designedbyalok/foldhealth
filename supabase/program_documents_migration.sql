-- Care-program documents: a patient's Program Documents library, scoped by
-- program_code + patient_id. Rows are created when a user uploads a file via
-- the inline DocumentUploader on the Program Documents step. The step is empty
-- by default (no seed rows) — documents accrue as they are uploaded.

CREATE TABLE IF NOT EXISTS program_documents (
  id           TEXT PRIMARY KEY,
  program_code TEXT,
  patient_id   TEXT,
  name         TEXT NOT NULL,
  type         TEXT,
  status       TEXT,
  size_bytes   BIGINT,
  updated_by   TEXT,
  updated_date TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE program_documents ENABLE ROW LEVEL SECURITY;

-- The policy this replaces was `FOR ALL USING (true) WITH CHECK (true)` granted
-- to PUBLIC. In Postgres PUBLIC means every role, including `anon` — the key
-- that ships in the browser bundle. Verified against production before this
-- change: as the anon role, SELECT, INSERT and DELETE on patient program
-- documents were all ALLOWED.
--
-- Its justification ("the app reads with the anon key, so a permissive policy
-- is required") was wrong. The only consumer is useAppStore's
-- fetchProgramDocuments / addProgramDocument, reached from the patient
-- right-panel Program Documents step, which is behind login. The one genuinely
-- anonymous route in this app is #/f/{id} (PublicFormView), which touches only
-- forms / form_responses.
DROP POLICY IF EXISTS "Allow all program_documents" ON program_documents;

-- Reads: any signed-in staff member, matching how every other clinical table
-- in this schema is scoped — whoever is looking at a patient sees that
-- patient's library. Deliberately FOR SELECT alone, so a future widening of
-- reads cannot silently widen writes.
DROP POLICY IF EXISTS program_documents_select ON program_documents;
CREATE POLICY program_documents_select
  ON program_documents FOR SELECT TO authenticated
  USING (true);

-- Writes: the caller must correspond to an active row in `profiles`. That is a
-- trusted membership table — `profiles` role columns are server-owned and
-- guarded by profiles_guard_authz_fields.sql — rather than a client-supplied
-- column such as updated_by, which the browser chooses freely. `Invited`
-- profiles cannot write until their account is actually active.
DROP POLICY IF EXISTS program_documents_insert ON program_documents;
CREATE POLICY program_documents_insert
  ON program_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

DROP POLICY IF EXISTS program_documents_update ON program_documents;
CREATE POLICY program_documents_update
  ON program_documents FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.status = 'Active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

DROP POLICY IF EXISTS program_documents_delete ON program_documents;
CREATE POLICY program_documents_delete
  ON program_documents FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

CREATE INDEX IF NOT EXISTS program_documents_program_patient_idx
  ON program_documents (program_code, patient_id);

-- ── Verify ────────────────────────────────────────────────────────────────
-- No policy may remain open to PUBLIC:
--   select policyname, cmd, roles::text, qual, with_check from pg_policies
--    where schemaname='public' and tablename='program_documents';
--   Expect four policies, all {authenticated}, and no `true` write predicate.
--
-- With the ANON key, every verb must now fail:
--   GET/POST/DELETE /rest/v1/program_documents  -> [] or 401/403, never a write.
--
-- ── Rollback ──────────────────────────────────────────────────────────────
--   drop policy if exists program_documents_select on program_documents;
--   drop policy if exists program_documents_insert on program_documents;
--   drop policy if exists program_documents_update on program_documents;
--   drop policy if exists program_documents_delete on program_documents;
--   create policy "Allow all program_documents" on program_documents
--     for all using (true) with check (true);
