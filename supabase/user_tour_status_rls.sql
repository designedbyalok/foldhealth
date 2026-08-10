-- Lock user_tour_status to its owner.
--
-- Why: ProductTour reads and writes this table from the browser, passing
-- `user_id` from the client session. With a permissive policy the anon key can
-- read or overwrite any user's tour state. The client filter is not a security
-- boundary — the database has to be. This replaces the blanket
-- "Allow all" policy with owner-scoped access driven by auth.uid().
--
-- Safe to run: ProductTour already falls back to localStorage when the DB call
-- fails (see getLocalSeenTours / markLocalTourSeen), so worst case tour state
-- becomes per-browser instead of per-account.

alter table public.user_tour_status enable row level security;

-- Default the owner column server-side so the client never has to assert it.
alter table public.user_tour_status
  alter column user_id set default auth.uid();

drop policy if exists "Allow all for user_tour_status" on public.user_tour_status;
drop policy if exists "Allow all for anon" on public.user_tour_status;
drop policy if exists "own tour status" on public.user_tour_status;

create policy "own tour status"
  on public.user_tour_status
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Verify:
--   select policyname, cmd, roles from pg_policies
--   where tablename = 'user_tour_status';
-- Expected: a single 'own tour status' policy scoped to {authenticated}.
