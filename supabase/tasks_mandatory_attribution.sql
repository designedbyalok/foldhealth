-- Make attribution mandatory on every task, at the database.
--
-- THE HOLE THIS CLOSES
-- The task audit log is enforced entirely in JavaScript, every callsite is
-- expected to (a) stamp `created_by` / `created_by_id` on the row and (b) write
-- a `task_audit_log` `created` entry after insert. It works today only because
-- every caller happens to do the right thing. The moment a new callsite forgets
-- one of those (see the previous shape of `createCareGapSignOffTask`, which
-- did neither), a task appears in TasksView with no creator and no history and
-- nothing complains. For a compliance surface, the guarantee has to sit below
-- the client.
--
-- WHAT THIS DOES
--   1. Backfills any existing rows missing `created_by` / `created_at` so the
--      NOT NULL constraint can attach without failing. `created_by` is set to
--      'System', an honest "we don't know who did this"; `created_at` is set
--      to `now()` for anything null.
--   2. Adds NOT NULL on `tasks.created_by` and `tasks.created_at`. From here
--      on, a task INSERT without a creator or timestamp is rejected by the
--      database, not by the client.
--   3. Adds an AFTER INSERT trigger on `tasks` that writes a row into
--      `task_audit_log` (action_type='created', user_name=NEW.created_by,
--      user_id=NEW.created_by_id, to_value=NEW.name, created_at=NEW.created_at).
--      The JS-side `logTaskAudit('created', …)` still fires; the DB trigger is
--      the belt on top of that suspenders, so a future caller that forgets to
--      call logTaskAudit still leaves an audit row.
--   4. Deduplicates: if the JS call has already written a `created` row for the
--      same task_id (same second), the trigger skips its insert. That keeps
--      the drawer's history from showing "created" twice for one task.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- No RLS change on `tasks.created_by`, unlike the HCC audit table, `tasks` is
-- routinely written by multiple actors on behalf of the same session (a
-- provider creates a task assigned to a care manager; a service worker adds a
-- TOC follow-up). Forcing `created_by = auth.uid()` here would break the
-- automation-actor pattern (`TOC Agent`, `HEDIS Automation`) that the app
-- relies on. Attribution accuracy for `tasks` is enforced in the client store
-- (createTask() rejects rows with no resolved actor).
--
-- The `task_audit_log` table itself is untouched (schema, policies). This
-- migration only guarantees that a `created` row lands there whenever a task
-- is inserted.

begin;

-- 1. Backfill so NOT NULL can attach.
update public.tasks
   set created_by = coalesce(created_by, 'System')
 where created_by is null;

update public.tasks
   set created_at = coalesce(created_at, now())
 where created_at is null;

-- 2. Enforce.
alter table public.tasks
  alter column created_by set not null,
  alter column created_at set not null;

-- 3. + 4. Trigger that mirrors the JS `logTaskAudit('created', …)` call.
create or replace function public.stamp_task_created_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Skip if the client already logged a `created` row for this task within the
  -- same second: the JS store writes one immediately after INSERT and we do
  -- not want a duplicate entry appearing in the drawer.
  if exists (
    select 1
      from public.task_audit_log
     where task_id = new.id
       and action_type = 'created'
       and abs(extract(epoch from (created_at - new.created_at))) < 2
  ) then
    return new;
  end if;

  insert into public.task_audit_log (task_id, user_name, user_id, action_type, from_value, to_value, created_at)
  values (new.id, new.created_by, new.created_by_id, 'created', null, new.name, new.created_at);
  return new;
end;
$$;

revoke all on function public.stamp_task_created_audit() from public, anon, authenticated;

drop trigger if exists tasks_stamp_created_audit on public.tasks;
create trigger tasks_stamp_created_audit
  after insert on public.tasks
  for each row execute function public.stamp_task_created_audit();

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Constraints in place:
--   select column_name, is_nullable
--     from information_schema.columns
--    where table_schema='public' and table_name='tasks'
--      and column_name in ('created_by','created_at');
--   Expect: both is_nullable = 'NO'.
--
-- Trigger attached:
--   select tgname from pg_trigger
--    where tgrelid = 'public.tasks'::regclass and not tgisinternal;
--   Expect row: tasks_stamp_created_audit.
--
-- Belt-and-suspenders behaviour: from a psql shell (no client, so no JS log
-- call happens), insert a task and verify an audit row lands.
--   insert into tasks (name, status, priority, due_date, member, created_by)
--   values ('DB-side probe', 'pending', 'medium', current_date, 'Test Patient', 'DB Probe')
--   returning id \gset
--   select action_type, user_name, to_value from task_audit_log where task_id = :id;
--   Expect: action_type='created', user_name='DB Probe', to_value='DB-side probe'.
--
-- Dedup: from the app, create a task through the UI. The JS store writes one
-- `created` row and the trigger sees it and skips.
--   select count(*) from task_audit_log
--    where task_id = <that task's id> and action_type='created';
--   Expect: 1.
--
-- Refusal: try to insert a task without created_by.
--   insert into tasks (name, status, priority, due_date, member)
--   values ('no-creator', 'pending', 'medium', current_date, 'x');
--   Expect: ERROR: null value in column "created_by" of relation "tasks"
--           violates not-null constraint.
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop trigger if exists tasks_stamp_created_audit on public.tasks;
--   drop function if exists public.stamp_task_created_audit();
--   alter table public.tasks alter column created_by drop not null;
--   alter table public.tasks alter column created_at drop not null;
