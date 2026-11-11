-- Department (practice location) on tasks and care program enrollments, so
-- Reassign Open Work (step 2 of an Out of Office record) groups them by
-- department like appointments and sends each to that department's covering
-- provider. Empty means: use the patient's latest appointment location.
-- Backfills the demo rows from ooo_demo_tasks_seed.sql and
-- ooo_demo_open_work_seed.sql.
-- Run on dev, then prod. Safe to re-run.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.patient_care_programs ADD COLUMN IF NOT EXISTS location text;

UPDATE public.tasks SET location = v.location
FROM (VALUES
  ('ooo-demo-aditi-1', 'AstranaCare Centennial Hills'),
  ('ooo-demo-aditi-2', 'Palm Health Centre'),
  ('ooo-demo-aditi-3', 'AstranaCare Centennial Hills'),
  ('ooo-demo-aditi-4', 'Palm Health Centre'),
  ('ooo-demo-aditi-5', 'AstranaCare Centennial Hills'),
  ('ooo-demo-aditi-6', 'Palm Health Centre'),
  ('ooo-demo-aditi-7', 'AstranaCare Centennial Hills'),
  ('ooo-demo-aditi-8', 'Palm Health Centre'),
  ('ooo-demo-aditi-9', 'AstranaCare Centennial Hills')
) AS v(source_key, location)
WHERE tasks.source_key = v.source_key AND tasks.location IS NULL;

UPDATE public.patient_care_programs SET location = v.location
FROM (VALUES
  ('pcp-ooo-demo-aditi-1', 'AstranaCare Centennial Hills'),
  ('pcp-ooo-demo-aditi-2', 'Palm Health Centre'),
  ('pcp-ooo-demo-aditi-3', 'AstranaCare Centennial Hills'),
  ('pcp-ooo-demo-aditi-4', 'Palm Health Centre')
) AS v(id, location)
WHERE patient_care_programs.id = v.id AND patient_care_programs.location IS NULL;
