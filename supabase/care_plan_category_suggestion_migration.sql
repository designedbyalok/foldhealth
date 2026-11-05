-- Template category switch suggestions. When a patient's latest results match
-- a different category than the one a template run follows, the care plan
-- suggests switching (lib/templateCategories.js categorySuggestions). Dismissing
-- the suggestion records that category on the run so it isn't offered again;
-- a later result matching yet another category is.
--
-- Additive and idempotent. Needs care_plan_template_categories_migration.sql.

ALTER TABLE public.patient_care_plan_template_instances
  ADD COLUMN IF NOT EXISTS dismissed_category_id text;

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.patient_care_plan_template_instances DROP COLUMN IF EXISTS dismissed_category_id;
