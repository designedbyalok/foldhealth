-- P360 profile card rebrand: the demo health plan reads "JADE Health",
-- rename to FoldHealth. Plan ids stay as sample data (only the name was
-- wrong); the banner shows health_plan_id, falling back to the patient's
-- Fold ID when a profile has none.

BEGIN;

UPDATE public.p360_profiles
SET    health_plan_name = 'FoldHealth'
WHERE  health_plan_name = 'JADE Health';

COMMIT;
