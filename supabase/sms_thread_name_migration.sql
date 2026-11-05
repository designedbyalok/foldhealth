-- FCS-5677: a custom name for a shared-number SMS thread (e.g. "Garcia
-- Family"). It replaces the members' names ("Annette, Liam, Ava") in the thread header and the Messages
-- list, survives a change of owner, is searchable, and is internal only
-- (never sent to the family). NULL shows the names.
--
-- Additive and idempotent: safe to run more than once. The app works before
-- it runs (names are kept in the browser until then).

ALTER TABLE public.patient_conversations
  ADD COLUMN IF NOT EXISTS thread_name text;
