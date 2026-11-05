-- Fold Pathway Library: care pathways Fold ships with every account
-- (Settings > Care Plan Library > Pathways). Fold's content, read-only to the
-- account: there are no insert, update or delete policies, so only the
-- service role (care_pathways_seed.sql) writes it. Client-uploaded guidance
-- is a clinical protocol (clinical_protocols), not a pathway.
--
--   gbi             { goals, interventions, barriers }, by Care Plan Library
--                   title (resolved to library ids in the app); interventions
--                   carry goalTitle, barriers goalTitles.
--   decision_logic  { thresholds, decisionRules } in the clinical protocol
--                   schema shapes; each item names its `source`.
--   cadence         recheck cadence, clinical protocol cadence shape.
--
-- A care plan template adapted from a pathway records which one and which
-- version in care_plan_templates.source_pathway.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.care_pathways (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  condition       text NOT NULL,
  version         text NOT NULL,
  summary         text NOT NULL DEFAULT '',
  sources         text[] NOT NULL DEFAULT '{}',
  gbi             jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_logic  jsonb NOT NULL DEFAULT '{}'::jsonb,
  cadence         jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order      integer NOT NULL DEFAULT 0,
  published_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.care_pathways ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in staff read care_pathways" ON public.care_pathways;
-- Signed-in staff read only; the public anon key gets nothing.
CREATE POLICY "Signed-in staff read care_pathways" ON public.care_pathways
  FOR SELECT TO authenticated
  USING ((select auth.uid()) is not null);

ALTER TABLE public.care_plan_templates
  -- { id, version, name } of the pathway a template was adapted from.
  ADD COLUMN IF NOT EXISTS source_pathway jsonb;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.care_plan_templates drop column if exists source_pathway;
--   drop table if exists public.care_pathways;
