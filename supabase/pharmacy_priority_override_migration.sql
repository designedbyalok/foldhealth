-- Pharmacy worklist: a priority picked on the worklist (the P column).
--
--   priority_override  P1, P2 or P3 when a user changed the row's priority;
--                      null keeps the plan file's priority (source_priority)
--                      or the one derived from the focus measure.
--
-- Idempotent: safe to run more than once.

alter table pharmacy_worklist_members
  add column if not exists priority_override text;

alter table pharmacy_worklist_members
  drop constraint if exists pharmacy_worklist_members_priority_override_check;

alter table pharmacy_worklist_members
  add constraint pharmacy_worklist_members_priority_override_check
  check (priority_override is null or priority_override in ('P1', 'P2', 'P3'));
