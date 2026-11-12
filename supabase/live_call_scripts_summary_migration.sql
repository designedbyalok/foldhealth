-- Live call scripts: the drafted summary of the whole call, which the Wrap Up
-- Call drawer offers when the transcript ran to the end (a call ended early
-- gets a summary built from what was covered instead). Additive, idempotent.

ALTER TABLE public.live_call_scripts ADD COLUMN IF NOT EXISTS summary text;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.live_call_scripts drop column if exists summary;
