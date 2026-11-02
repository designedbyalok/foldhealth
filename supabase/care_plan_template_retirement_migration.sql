-- Care plan template retirement. A supervisor retires a template (status
-- 'archived', shown as Retired; the Suggestions "Retire" uses the same
-- status) with an optional replacement: "Use Diabetes v2 instead".
-- Retired templates can't be picked for new plans; plans already using one
-- keep it and point at the replacement, and automations attach the
-- replacement instead (lib/templateRetirement.js).
--
-- Additive and idempotent.

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS replaced_by_template_id uuid REFERENCES public.care_plan_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_by text,
  ADD COLUMN IF NOT EXISTS retired_reason text;

CREATE INDEX IF NOT EXISTS care_plan_templates_replaced_by_idx ON public.care_plan_templates (replaced_by_template_id);

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.care_plan_templates_replaced_by_idx;
-- ALTER TABLE public.care_plan_templates
--   DROP COLUMN IF EXISTS retired_reason, DROP COLUMN IF EXISTS retired_by,
--   DROP COLUMN IF EXISTS retired_at, DROP COLUMN IF EXISTS replaced_by_template_id;
