-- Remove the last anonymous grants outside `profiles`.
--
-- Production always authenticates: the dev bypass button renders only when
-- window.location.hostname === 'localhost' (LoginPage.jsx:426), and App.jsx:40
-- notes those sessions stay anonymous. So nothing deployed reads or writes
-- these tables as `anon`; the grants are attack surface only.
--
-- Two different shapes here, handled differently:
--
--   call_lines / call_nav_items / call_sessions
--     Each already has a SEPARATE `_read_authenticated` policy with the same
--     USING (true). Dropping the `_read_anon` twin changes nothing for a
--     logged-in user. call_sessions additionally keeps its
--     `call_sessions_write_authenticated` ALL policy.
--
--   hcc_activity_log
--     Its two policies are granted to {anon,authenticated} TOGETHER, so there
--     is no anon-only policy to drop, dropping them would revoke access for
--     real users too. ALTER POLICY ... TO authenticated narrows the role list
--     while leaving USING / WITH CHECK untouched.
--
--     This one matters most: `hcc_activity_log_insert` allowed an
--     unauthenticated caller to write the HCC audit log (1,264 rows today).
--     Forged audit entries are a compliance problem, not just a data one.

begin;

-- Anon-only twins: safe to drop outright.
drop policy if exists "call_lines_read_anon"     on public.call_lines;
drop policy if exists "call_nav_items_read_anon" on public.call_nav_items;
drop policy if exists "call_sessions_read_anon"  on public.call_sessions;

-- Shared policies: narrow the role list, keep the expressions.
alter policy "hcc_activity_log_select" on public.hcc_activity_log to authenticated;
alter policy "hcc_activity_log_insert" on public.hcc_activity_log to authenticated;

commit;

-- ── Verify ────────────────────────────────────────────────────────────────
-- select tablename, policyname, cmd, roles::text
--   from pg_policies
--  where schemaname='public' and roles::text like '%anon%'
--  order by tablename, policyname;
-- Expected: zero rows anywhere in the public schema.
--
-- Confirm hcc_activity_log kept its expressions:
-- select policyname, cmd, roles::text, qual, with_check
--   from pg_policies where tablename='hcc_activity_log';
-- Expected: roles {authenticated}, qual/with_check still `true`.
--
-- ── Rollback ──────────────────────────────────────────────────────────────
-- create policy "call_lines_read_anon"     on public.call_lines     for select to anon using (true);
-- create policy "call_nav_items_read_anon" on public.call_nav_items for select to anon using (true);
-- create policy "call_sessions_read_anon"  on public.call_sessions  for select to anon using (true);
-- alter policy "hcc_activity_log_select" on public.hcc_activity_log to anon, authenticated;
-- alter policy "hcc_activity_log_insert" on public.hcc_activity_log to anon, authenticated;
