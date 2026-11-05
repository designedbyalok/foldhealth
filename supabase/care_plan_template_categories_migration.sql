-- Care plan template categories. A template's goals, interventions and
-- barriers are its Common section; `categories` adds named groups with entry
-- criteria (chronic conditions, latest lab results) and their own goals,
-- interventions and barriers:
--   [{ id, name, match: 'all'|'any', criteria: [...], goals: [], interventions: [], barriers: [] }]
-- (src/features/settings/care-plan-library/lib/templateCategories.js).
-- Applying the template gives a patient Common + the category they match (or
-- the one the care manager picks); the run records which.
--
-- Additive and idempotent.

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.patient_care_plan_template_instances
  ADD COLUMN IF NOT EXISTS category_id text,
  ADD COLUMN IF NOT EXISTS category_name text;

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.patient_care_plan_template_instances DROP COLUMN IF EXISTS category_name, DROP COLUMN IF EXISTS category_id;
-- ALTER TABLE public.care_plan_templates DROP COLUMN IF EXISTS categories;
