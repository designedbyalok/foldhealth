-- Lock down forms / form_responses: the last two tables where `anon`
-- could read AND write everything.
--
-- Why: RLS_POSTURE.md deliberately keeps these anon-READABLE so a patient
-- can open a shared #/f/{id} link without an account. But the original
-- policies were never scoped beyond "everything for everyone", which a live
-- probe confirmed:
--
--   GET    /rest/v1/form_responses  as anon → 200 with patient answers
--   PATCH  form_responses?id=eq.N   as anon → 204 (tamper with submissions)
--   DELETE forms?id=eq.N            as anon → 204 (delete any form)
--   POST   form_responses           as anon → passes RLS (spam vector)
--   GET    forms                    as anon → returns DRAFTS, not just shared
--
-- The anon key ships in the deployed JS bundle, so "knowing the key" is no
-- barrier. Every response row is one curl away from the public internet.
--
-- Design (keeps patient filling working end-to-end):
--
--   forms
--     anon    SELECT restricted to status='active', share links serve
--             published forms only; drafts stop leaking.
--     anon    no writes. Builder CRUD is staff-only.
--   form_responses
--     anon    INSERT allowed: that IS the anonymous patient submission.
--     anon    UPDATE allowed ONLY while the row is still 'in_progress' and
--             stays 'in_progress' or flips to 'completed'. This preserves
--             savePartialResponse's upsert autosave and FormView's
--             submit-time flip of the same session row, while closing the
--             tamper path against completed submissions. Sequential bigint
--             ids make enumeration trivial, so this is a compromise, not a
--             guarantee: flagged in RLS_POSTURE.md follow-ups.
--     anon    no SELECT (a filler never reads back), no DELETE.
--   authenticated  full access to both, as today.
--
-- Existing policy names are unknown (forms_migration.sql predates the repo),
-- so every policy on these two tables is dropped first and rebuilt here.

begin;

-- Existing policy names are unknown (forms_migration.sql predates the repo),
-- so drop every policy on these two tables and rebuild below.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public' and tablename in ('forms', 'form_responses')
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.forms           enable row level security;
alter table public.form_responses  enable row level security;

-- ── forms ──────────────────────────────────────────────────────────────────
create policy "forms_select_authenticated"
  on public.forms for select to authenticated
  using ((select auth.uid()) is not null);

create policy "forms_insert_authenticated"
  on public.forms for insert to authenticated
  with check ((select auth.uid()) is not null);

create policy "forms_update_authenticated"
  on public.forms for update to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

create policy "forms_delete_authenticated"
  on public.forms for delete to authenticated
  using ((select auth.uid()) is not null);

create policy "forms_select_active_anon"
  on public.forms for select to anon
  using (status = 'active');

-- ── form_responses ─────────────────────────────────────────────────────────
create policy "form_responses_select_authenticated"
  on public.form_responses for select to authenticated
  using ((select auth.uid()) is not null);

create policy "form_responses_insert_anon"
  on public.form_responses for insert to anon
  with check (true);

-- Autosave upsert writes status='in_progress'; the submit upsert flips the
-- same session row to 'completed'. Both must pass WITH CHECK.
create policy "form_responses_update_inprogress_anon"
  on public.form_responses for update to anon
  using (status = 'in_progress')
  with check (status in ('in_progress', 'completed'));

create policy "form_responses_insert_authenticated"
  on public.form_responses for insert to authenticated
  with check ((select auth.uid()) is not null);

create policy "form_responses_update_authenticated"
  on public.form_responses for update to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

create policy "form_responses_delete_authenticated"
  on public.form_responses for delete to authenticated
  using ((select auth.uid()) is not null);

commit;

-- ── Verify ────────────────────────────────────────────────────────────────
-- select tablename, policyname, cmd, roles::text
--   from pg_policies
--  where schemaname='public' and tablename in ('forms','form_responses')
--  order by tablename, policyname;
-- Expected: exactly the 11 policies above, nothing else.
--
-- With the ANON key:
--   GET /rest/v1/form_responses?select=id&limit=1   -> []
--   GET /rest/v1/forms?select=id&limit=1            -> active rows only
--   PATCH form_responses?id=eq.<completed row>      -> 403
--   DELETE forms?id=eq.N                            -> 403
--   POST form_responses {active form_id}            -> 201 (patient fill)
--
-- Logged-in: worklist, builder CRUD, analytics responses all unchanged.

-- ── Rollback ──────────────────────────────────────────────────────────────
-- drop all "forms_*" / "form_responses_*" policies above, then:
-- create policy "public_access" on public.forms          for all to anon, authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
-- create policy "public_access" on public.form_responses for all to anon, authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
-- (i.e. restore the previous state, not recommended; see probe results)
