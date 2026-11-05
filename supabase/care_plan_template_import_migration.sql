-- Care plan template bulk import (Care Plan Library > Import). Each upload is
-- one batch; its templates land as drafts carrying the batch id. A template
-- that updates a published one is saved as a draft revision pointing at it
-- (replaces_template_id) and replaces it when approved.

CREATE TABLE IF NOT EXISTS public.care_plan_template_imports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   text NOT NULL,
  -- { "add": n, "update": n, "skip": n, "errors": n, "warnings": n }
  totals      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Per template: name, action, why, issues (what the preview showed).
  summary     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.care_plan_template_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in staff on care_plan_template_imports" ON public.care_plan_template_imports;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Signed-in staff on care_plan_template_imports" ON public.care_plan_template_imports
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS import_batch_id      uuid REFERENCES public.care_plan_template_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaces_template_id uuid REFERENCES public.care_plan_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by          text,
  ADD COLUMN IF NOT EXISTS approved_at          timestamptz;

CREATE INDEX IF NOT EXISTS care_plan_templates_import_batch_idx ON public.care_plan_templates (import_batch_id);

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.care_plan_templates drop column if exists import_batch_id,
--     drop column if exists replaces_template_id, drop column if exists approved_by,
--     drop column if exists approved_at;
--   drop table if exists public.care_plan_template_imports;
