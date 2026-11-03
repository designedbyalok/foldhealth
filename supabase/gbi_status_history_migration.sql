-- GBI status history (#62, feeds the activity log in #63).
--
-- One row per status change on a care plan goal, intervention or barrier:
-- from and to status, the reason and an optional note. The app asks for a
-- reason on every manual change (required for Met / Resolved, Discontinued
-- and On Hold; care-plan/lib/gbiStatusReasons.js). Changes made by
-- automations (program status rules) are recorded too, with their reason and
-- source 'automation'. The latest reason also stays on the item's
-- status_reason column (gbi_status_reason_migration.sql) for its badge.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.gbi_status_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    text        NOT NULL,
  program_id    text        NOT NULL,
  entity_type   text        NOT NULL CHECK (entity_type IN ('goal', 'intervention', 'barrier')),
  entity_id     text        NOT NULL,
  entity_title  text        NOT NULL DEFAULT '',
  from_status   text,
  to_status     text        NOT NULL,
  reason        text,
  note          text,
  source        text        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'bulk', 'automation', 'event')),
  changed_by    text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gbi_status_history_entity_idx ON public.gbi_status_history (entity_type, entity_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS gbi_status_history_plan_idx ON public.gbi_status_history (patient_id, program_id, changed_at DESC);

ALTER TABLE public.gbi_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gbi_status_history_all ON public.gbi_status_history;
CREATE POLICY gbi_status_history_all ON public.gbi_status_history
  FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.gbi_status_history;
