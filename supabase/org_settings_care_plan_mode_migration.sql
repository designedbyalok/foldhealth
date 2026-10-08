-- Care plan level: where an org keeps its care plans.
--
--   program  care plans live in each care program's Care Plan step (default,
--            and how every existing org works today, e.g. Astrana)
--   patient  one patient-level care plan in Care Management > Care Plan;
--            the program Care Plan step is hidden
--   both     program care plans, plus an editable patient-level roll-up of
--            all of them in Care Management > Care Plan
--
-- A text column with a CHECK rather than booleans: the three setups are one
-- choice, and a closed set reads better in the data than two flags.
--
-- RLS is unchanged; the existing org_settings policies cover the column.

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS care_plan_mode text NOT NULL DEFAULT 'program';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_settings_care_plan_mode_check'
  ) THEN
    ALTER TABLE public.org_settings
      ADD CONSTRAINT org_settings_care_plan_mode_check
      CHECK (care_plan_mode IN ('program', 'patient', 'both'));
  END IF;
END $$;
