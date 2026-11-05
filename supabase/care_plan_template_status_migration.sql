-- Care plan templates: draft vs published
--
-- "Save as Draft" in New Care Plan keeps a template out of the Plan Template
-- tab until it is finished, so the library needs to know which state a
-- template is in. A single `status` column rather than a boolean, because the
-- states are a small closed set that may grow (archived), and a text column
-- with a CHECK reads better in the data than `is_draft = false`.
--
-- Existing rows are published: they were authored before drafts existed and
-- are already in use.
--
-- RLS is unchanged: the policy lives on the table, not the column.

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'care_plan_templates_status_check'
  ) THEN
    ALTER TABLE public.care_plan_templates
      ADD CONSTRAINT care_plan_templates_status_check
      CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

-- The library lists one status at a time, so the filter is worth an index.
CREATE INDEX IF NOT EXISTS care_plan_templates_status_idx
  ON public.care_plan_templates (status);
