-- Remove anonymous access to profiles.
--
-- These four policies let anyone holding the public anon key, which ships in
-- the browser bundle by design: read, insert, update or delete ANY profile
-- row, including the `role` and `admin_role` columns. That is the direct path
-- to self-assigning administrator, and it bypasses handle_new_user() entirely,
-- so the signup-default fix does not close it.
--
--   Anon can read all profiles    SELECT  using (true)
--   Anon can insert profiles      INSERT  with check (true)
--   Anon can update profiles      UPDATE  using (true)
--   Anon can delete profiles      DELETE  using (true)
--
-- Verified safe before writing:
--
-- 1. Production always authenticates. The only unauthenticated path is the
--    dev bypass, and LoginPage.jsx:426 renders that button solely when
--    `window.location.hostname === 'localhost'`. App.jsx:40 documents that
--    those sessions "stay anonymous". So no deployed traffic uses the anon
--    role against this table.
--
-- 2. Every application operation is already covered for `authenticated`:
--
--      SELECT: "Authenticated users can read all profiles" and
--                "profiles_read_all_authenticated", both USING (true). All 11
--                read sites keep working, including the 5 that read every row
--                (user directory, chat contacts, scheduling, calendar,
--                people-pickers).
--      INSERT: "profiles_self_insert" (auth.uid() = id) covers AppLayout's
--                fallback insert.
--      UPDATE: "Users can update own profile" and
--                "profiles_self_update_identity" for self, plus
--                "Admins can update any profile" for administrators.
--      DELETE: there is NO authenticated DELETE policy, so UsersTab's
--                delete-user is already blocked for logged-in users today
--                (it handles the empty result: "Check permissions"). Dropping
--                the anon policy changes nothing for real users; it only
--                removes the ability for an unauthenticated caller to delete
--                profiles.
--
-- Net effect on the product: none in production. Local dev-bypass sessions
-- will see empty user lists until they log in, which is the correct behaviour.
--
-- Not touched: the service_role policy (server-side admin work) and every
-- authenticated policy above.

begin;

drop policy if exists "Anon can delete profiles" on public.profiles;
drop policy if exists "Anon can update profiles" on public.profiles;
drop policy if exists "Anon can insert profiles" on public.profiles;
drop policy if exists "Anon can read all profiles" on public.profiles;

commit;

-- ── Verify ────────────────────────────────────────────────────────────────
-- select policyname, cmd, roles::text, qual, with_check
--   from pg_policies where schemaname='public' and tablename='profiles'
--  order by cmd, policyname;
-- Expected: no policy with roles = {anon} remains. The service_role policy
-- and the authenticated self/admin/read-all policies stay.
--
-- Confirm the anon key really is locked out (run with the anon key, not the
-- service role): select * from profiles  -> 0 rows.
--
-- ── Rollback ──────────────────────────────────────────────────────────────
-- create policy "Anon can read all profiles" on public.profiles
--   for select to anon using (true);
-- create policy "Anon can insert profiles" on public.profiles
--   for insert to anon with check (true);
-- create policy "Anon can update profiles" on public.profiles
--   for update to anon using (true);
-- create policy "Anon can delete profiles" on public.profiles
--   for delete to anon using (true);
