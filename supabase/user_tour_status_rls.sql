-- Lock user_tour_status to its owner.
--
-- Verified against production before writing (2026-08-10):
--   • RLS is already enabled on the table.
--   • Four correct owner-scoped policies already exist for PUBLIC, all keyed
--     on `auth.uid() = user_id`.
--   • Four permissive `anon` policies also exist: SELECT/INSERT/UPDATE/DELETE
--     with `true`, which let anyone holding the public anon key read, alter
--     or delete every user's tour state. Policies are OR'd, so these four are
--     the entire hole.
--
-- The fix is therefore to drop the four anon policies, not to add new ones.
-- Afterwards the surviving PUBLIC policies still apply to anon, but
-- `auth.uid()` is NULL for an anonymous session so `auth.uid() = user_id`
-- is never true and anon gets nothing.
--
-- Impact: unauthenticated sessions (the "Continue without login" dev path)
-- stop persisting tour state to the database. ProductTour already falls back
-- to localStorage when the DB call fails, so tours degrade to per-browser
-- rather than breaking.

begin;

drop policy if exists "Anon can read all tour status" on public.user_tour_status;
drop policy if exists "Anon can insert tour status"   on public.user_tour_status;
drop policy if exists "Anon can upsert tour status"   on public.user_tour_status;
drop policy if exists "Anon can delete tour status"   on public.user_tour_status;

-- Let the database assert the owner so the client never has to send it.
alter table public.user_tour_status
  alter column user_id set default auth.uid();

commit;

-- Verify:
--   select policyname, cmd, roles::text, qual from pg_policies
--   where tablename = 'user_tour_status' order by policyname;
-- Expected: only the four "Users can … own tour status" policies remain.
