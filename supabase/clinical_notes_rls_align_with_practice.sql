-- Bring clinical_notes RLS in line with the rest of the schema.
--
-- WHAT WAS WRONG
-- clinical_notes shipped with three policies that gate INSERT/UPDATE on
-- (author_id = auth.uid() OR reviewer_id = auth.uid()) and no DELETE policy
-- at all. That breaks two real workflows the app supports:
--
--   1. Sign-off. completeCareGapSignOffTask (useAppStore.js:8453) fires
--      signClinicalNote whenever a review task is completed. The signer is
--      almost always the reviewer, but not always: a supervising NP, QA lead,
--      or someone reassigned onto the task after it moved will fail the
--      policy with 42501. The store already swallows the error and keeps a
--      local optimistic row, so the sign flips in the current session but is
--      gone on reload.
--
--   2. Delete. deleteClinicalNote (useAppStore.js:8438) always fails because
--      no DELETE policy exists. Same silent local-only behavior.
--
-- The store's schema-tolerant fallbacks were written for the "table missing
-- in dev" case (42P01/PGRST205), not for RLS denials. So 42501 falls through
-- to console.error and the write is lost.
--
-- Why the strict policies are wrong for THIS codebase
-- RLS_POSTURE.md records the deliberate practice-wide model: one practice,
-- every signed-in staff member sees everything. Every hot table in the schema
-- carries `USING (true) WITH CHECK (true) TO authenticated`. Access control
-- is a UI concern (surface the right notes to the right role), not an RLS
-- concern. clinical_notes is the outlier and needs to match.
--
-- The tighter policies do not add real security either: any authenticated
-- user can already SELECT every clinical note, so an attacker who wanted to
-- forge one could read someone else's author_id and set it in the insert.
-- The policies raise the noise floor without raising the ceiling.
--
-- WHAT THIS DOES
-- Drops the three legacy clinical_notes policies and replaces them with a
-- single `FOR ALL TO authenticated USING (true) WITH CHECK (true)` policy,
-- matching every other public table in the schema.
--
-- WHAT THIS DOES NOT DO
-- clinical_note_versions keeps its append-only shape (INSERT + SELECT to
-- authenticated, no UPDATE/DELETE). Version history should not need edits
-- from the client, and the reported 42501s are on clinical_notes writes, not
-- versions. If a legitimate versions write ever fails we can revisit then.
--
-- tasks is deliberately excluded despite the user asking about it: the DB
-- shows `Allow all for tasks` for ALL to authenticated with USING/WITH CHECK
-- both true, so tasks writes cannot emit 42501. If task sign-off feels
-- ephemeral, the cause is elsewhere (the sign-off path only writes
-- clinical_notes, not tasks, so fixing clinical_notes fixes the visible
-- symptom).

begin;

drop policy if exists "clinical_notes: authenticated read"        on public.clinical_notes;
drop policy if exists "clinical_notes: author or reviewer insert" on public.clinical_notes;
drop policy if exists "clinical_notes: author or reviewer update" on public.clinical_notes;

create policy "clinical_notes: authenticated full access"
  on public.clinical_notes
  for all
  to authenticated
  using (true)
  with check (true);

commit;

-- Verify
--   select policyname, cmd, roles::text, qual, with_check
--     from pg_policies
--    where schemaname='public' and tablename='clinical_notes'
--    order by policyname;
--   Expect: one row, "clinical_notes: authenticated full access", cmd=ALL,
--           roles={authenticated}, qual=true, with_check=true.
--
-- End to end: complete a HEDIS care-gap sign-off task as a user who is
-- neither the note's author nor its reviewer. The clinical_notes row should
-- flip to status=signed and survive a reload. Delete a note; the row should
-- disappear from the DB, not just from local state.
--
-- Rollback (restores the previous stricter policies)
--   drop policy "clinical_notes: authenticated full access" on public.clinical_notes;
--   create policy "clinical_notes: authenticated read" on public.clinical_notes
--     for select to authenticated using (true);
--   create policy "clinical_notes: author or reviewer insert" on public.clinical_notes
--     for insert to authenticated
--     with check ((author_id = auth.uid()) or (reviewer_id = auth.uid()));
--   create policy "clinical_notes: author or reviewer update" on public.clinical_notes
--     for update to authenticated
--     using ((author_id = auth.uid()) or (reviewer_id = auth.uid()))
--     with check ((author_id = auth.uid()) or (reviewer_id = auth.uid()));
