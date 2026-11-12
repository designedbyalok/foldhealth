-- Live call scripts: the Unity agent's handoff notes (what the agent found
-- before paging the care manager), shown as Handoff From <agent> in the
-- call brief. Additive, idempotent.

ALTER TABLE public.live_call_scripts ADD COLUMN IF NOT EXISTS handoff jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.live_call_scripts drop column if exists handoff;
