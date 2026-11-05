-- The clinical protocol (and version) a care plan template was drafted from.
-- New Care Plan can start from an Active protocol in Settings > Clinical
-- Protocols; its thresholds, cadence and titration guide the UnityAI draft,
-- and the template keeps { id, title, version, organization } here so it
-- shows "Based on" and the protocol lists the templates built from it.
-- Mirrors source_pathway (care_pathways_migration.sql).
--
-- Additive and idempotent.

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS source_protocol jsonb;

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.care_plan_templates DROP COLUMN IF EXISTS source_protocol;
