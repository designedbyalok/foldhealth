-- Department (practice location) on tasks and care program enrollments, so
-- Reassign Open Work (step 2 of an Out of Office record) groups them by
-- department like appointments and sends each to that department's covering
-- provider. Empty means: use the patient's latest appointment location.
-- Backfills the demo rows from ooo_demo_tasks_seed.sql,
-- ooo_demo_open_work_seed.sql, ooo_demo_navin_seed.sql and
-- ooo_demo_more_users_seed.sql.
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
  ('ooo-demo-aditi-9', 'AstranaCare Centennial Hills'),
  ('ooo-demo-navin-1', 'Carson City Center'),
  ('ooo-demo-navin-2', 'Carson City Center'),
  ('ooo-demo-navin-3', 'Carson City Center'),
  ('ooo-demo-navin-4', 'Home Health Centre'),
  ('ooo-demo-navin-5', 'Home Health Centre'),
  ('ooo-demo-navin-6', 'Carson City Center'),
  ('ooo-demo-navin-7', 'Home Health Centre'),
  ('ooo-demo-navin-8', 'Home Health Centre'),
  ('ooo-demo-abhijit-1', '7 Hills Department'),
  ('ooo-demo-abhijit-2', 'Adrian Health Partners'),
  ('ooo-demo-abhijit-3', '7 Hills Department'),
  ('ooo-demo-abhijit-4', 'Adrian Health Partners'),
  ('ooo-demo-amar-1', 'Mary Health'),
  ('ooo-demo-amar-2', 'Mary Health'),
  ('ooo-demo-amar-3', 'Riverside Clinic'),
  ('ooo-demo-amar-4', 'Riverside Clinic'),
  ('ooo-demo-ajay-1', 'Carson City Center'),
  ('ooo-demo-ajay-2', 'Mary Health'),
  ('ooo-demo-ajay-3', 'Carson City Center')
) AS v(source_key, location)
WHERE tasks.source_key = v.source_key AND tasks.location IS NULL;

UPDATE public.patient_care_programs SET location = v.location
FROM (VALUES
  ('pcp-ooo-demo-aditi-1', 'AstranaCare Centennial Hills'),
  ('pcp-ooo-demo-aditi-2', 'Palm Health Centre'),
  ('pcp-ooo-demo-aditi-3', 'AstranaCare Centennial Hills'),
  ('pcp-ooo-demo-aditi-4', 'Palm Health Centre'),
  ('pcp-ooo-demo-navin-1', 'Carson City Center'),
  ('pcp-ooo-demo-navin-2', 'Home Health Centre'),
  ('pcp-ooo-demo-navin-3', 'Home Health Centre'),
  ('pcp-ooo-demo-abhijit-1', '7 Hills Department'),
  ('pcp-ooo-demo-abhijit-2', 'Adrian Health Partners'),
  ('pcp-ooo-demo-amar-1', 'Riverside Clinic'),
  ('pcp-ooo-demo-amar-2', 'Mary Health'),
  ('pcp-ooo-demo-ajay-1', 'Carson City Center')
) AS v(id, location)
WHERE patient_care_programs.id = v.id AND patient_care_programs.location IS NULL;
