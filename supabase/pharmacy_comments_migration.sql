-- Pharmacy worklist: comments on a member (Pharmacy Gap Details > Comments).
--
--   comments  jsonb array, newest first, of
--             { id, author, authorId, role, date, time, body,
--               mentionIds, edited }
--
-- Idempotent: safe to run more than once.

alter table pharmacy_worklist_members
  add column if not exists comments jsonb not null default '[]'::jsonb;
