-- Program time attribution (care management redesign prototype): the
-- time-billed program a logged timer session counts toward (CCM, BHI, PCM,
-- RPM). Rows logged before this read as CCM. Additive, idempotent.

ALTER TABLE public.ccm_billable_activities ADD COLUMN IF NOT EXISTS program_code text NOT NULL DEFAULT 'CCM';

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.ccm_billable_activities drop column if exists program_code;
