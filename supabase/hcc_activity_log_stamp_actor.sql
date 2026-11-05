-- Make the HCC audit log say who actually wrote each row.
--
-- THE HOLE THIS CLOSES
-- `hcc_activity_log_insert` is WITH CHECK (true) for authenticated. Every
-- actor column, actor_id, actor_name, actor_role, arrives from the browser
-- and is written verbatim. Any signed-in user can POST a row attributed to
-- anybody, with any headline, at any timestamp. For a table whose entire job is
-- to be the compliance record of who touched which chart, that is the one
-- property it must have and does not.
--
-- drop_remaining_anon_policies.sql already called this policy out as the one
-- that "matters most" when it took `anon` off it. Taking anon off stopped
-- strangers forging entries; it did nothing about a logged-in user forging
-- entries as a colleague.
--
-- It is worse than it looks, because today the log cannot identify anyone at
-- all: makeActivityRow() sets `actor_id: payload.actorId || scope.actorId ||
-- null` (src/features/hcc/activityLog.js:141) and NOTHING in the codebase ever
-- passes actorId: `grep -rn actorId src` finds only that line and a UI key
-- filter. So actor_id is null on every one of the ~1,264 existing rows. The
-- audit trail has never had a real actor.
--
-- WHAT THIS DOES
--   1. A BEFORE INSERT trigger that overwrites actor_id with auth.uid() for any
--      caller holding a JWT. Client input for that column is discarded, not
--      validated: there is no version of "the browser knows best" here.
--   2. WITH CHECK (actor_id = auth.uid()::text) on the INSERT policy, so the
--      guarantee is enforced by RLS and not merely by the trigger. Belt and
--      braces: the trigger makes correct inserts succeed, the policy makes
--      incorrect ones impossible. Postgres evaluates WITH CHECK against the row
--      AFTER BEFORE-triggers have fired, so these compose rather than fight.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- actor_name and actor_role stay client-supplied, and that is intentional,
-- they are DISPLAY labels, not identity. The timeline legitimately writes
-- actor_name = 'System' for automated events (useAppStore.js:865) and 'SFTP'
-- for unattended ingest (HccHistoryDrawer.jsx:541), and HccHistoryDrawer
-- filters and groups on those exact strings (:135, :172, :208). Forcing them to
-- the signed-in user's name would relabel every machine-generated row as a
-- human and break the "Uploaded by" grouping.
--
-- The distinction to keep in your head: actor_name answers "what should this
-- row read as", actor_id now answers "who is accountable for it". Only the
-- second one is evidence. Reconcile against actor_id, never actor_name.
--
-- Append-only is already true and stays true: the table has exactly two
-- policies, SELECT and INSERT. With RLS on and no UPDATE or DELETE policy,
-- both are denied by default for authenticated. Nothing to add.
--
-- Existing rows keep actor_id = null. They are not retro-attributable, the
-- information was never captured: and inventing it would be the exact forgery
-- this migration exists to prevent. Null is the honest value.
--
-- NOT SECURITY DEFINER, on purpose. It needs no privilege it does not already
-- have, and a definer trigger here would re-open the lint finding that
-- lock_down_security_definer_functions.sql just closed.

begin;

create or replace function public.stamp_hcc_activity_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT: service_role, the SQL editor, seeds and the api/ functions. Those
  -- bypass RLS entirely, so stamping here would be theatre, and clobbering a
  -- seeded actor_id would corrupt fixtures. Leave the row as supplied.
  if auth.uid() is null then
    return new;
  end if;

  -- A JWT holder does not get to choose who they are.
  new.actor_id := auth.uid()::text;
  return new;
end;
$$;

revoke all on function public.stamp_hcc_activity_actor() from public, anon, authenticated;

drop trigger if exists hcc_activity_log_stamp_actor on public.hcc_activity_log;
create trigger hcc_activity_log_stamp_actor
  before insert on public.hcc_activity_log
  for each row execute function public.stamp_hcc_activity_actor();

-- The policy the trigger makes satisfiable.
drop policy if exists "hcc_activity_log_insert" on public.hcc_activity_log;
create policy "hcc_activity_log_insert"
  on public.hcc_activity_log
  for insert
  to authenticated
  with check (actor_id = auth.uid()::text);

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Policy no longer reads `true`:
--   select policyname, cmd, roles::text, with_check
--     from pg_policies
--    where schemaname='public' and tablename='hcc_activity_log';
--   Expect: hcc_activity_log_insert / INSERT / {authenticated}
--           / (actor_id = (auth.uid())::text)
--           hcc_activity_log_select unchanged, qual `true`.
--
-- Trigger attached:
--   select tgname from pg_trigger
--    where tgrelid = 'public.hcc_activity_log'::regclass and not tgisinternal;
--   Expect: hcc_activity_log_stamp_actor
--
-- From the app, signed in: open a chart and change an assignee, then check the
-- newest row carries YOUR id even though the client sent none,
--   select ts, event_name, actor_id, actor_name
--     from hcc_activity_log order by ts desc limit 5;
--   Expect: actor_id = your auth user id on the new row, null on older ones.
--
-- Forgery is refused. From a signed-in browser session:
--   await supabase.from('hcc_activity_log')
--     .insert({ event_name: 'patient.field_edited', actor_id: '<someone-else>' })
--   Expect: the row is written with YOUR actor_id, not theirs. The trigger
--   overwrites before the check runs, so this succeeds-but-corrected rather
--   than erroring: the forged value never reaches the table either way.
--
-- Seeds still work (no auth.uid(), trigger no-ops):
--   node scripts/seed.js   → inserts unaffected.
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop trigger if exists hcc_activity_log_stamp_actor on public.hcc_activity_log;
--   drop function if exists public.stamp_hcc_activity_actor();
--   drop policy if exists "hcc_activity_log_insert" on public.hcc_activity_log;
--   create policy "hcc_activity_log_insert" on public.hcc_activity_log
--     for insert to authenticated with check (true);
