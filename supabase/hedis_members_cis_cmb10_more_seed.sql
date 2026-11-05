-- Demo: five pediatric HEDIS members with an open CIS-CMB10 gap and a
-- blank Vaccine Calendar.
--
-- WHY
-- The demo walks through the CIS workflow from scratch: entering doses,
-- scheduling reminders and logging outreach. These members (id = member_id,
-- 19309-19313) have no immunization history, so nothing is pre-filled.
-- Ages are 1 day, 2 months and 5 months as of Oct 27, 2026; their dose
-- statuses move on as time passes.
--
-- No schema changes. Idempotent: re-running resets dob, age and gap dates.
--
-- Ask Alok Kumar to run this seed on Supabase.

BEGIN;

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
VALUES
  ('19309', 'OB', 'Olivia Bennett', 'F', '2m', '19309', 'en', '[{"code":"CIS-CMB10","status":"Open","startDate":"10/01/2026"}]'::jsonb, NULL, NULL, '10/01/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 301-9309', '08/27/2026', 'Astrana', 'HP-001', '90012', 'Los Angeles', 'CA'),
  ('19310', 'JW', 'James Wilson', 'M', '5m', '19310', 'en', '[{"code":"CIS-CMB10","status":"Open","startDate":"10/01/2026"}]'::jsonb, NULL, NULL, '10/01/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 301-9310', '05/27/2026', 'Astrana', 'HP-001', '90012', 'Los Angeles', 'CA'),
  ('19311', 'MG', 'Mia Garcia', 'F', '1d', '19311', 'en', '[{"code":"CIS-CMB10","status":"Open","startDate":"10/26/2026"}]'::jsonb, NULL, NULL, '10/26/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 301-9311', '10/26/2026', 'Astrana', 'HP-001', '90012', 'Los Angeles', 'CA'),
  ('19312', 'LO', 'Lucas Okafor', 'M', '2m', '19312', 'en', '[{"code":"CIS-CMB10","status":"Open","startDate":"10/01/2026"}]'::jsonb, NULL, NULL, '10/01/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 301-9312', '08/27/2026', 'Astrana', 'HP-001', '90012', 'Los Angeles', 'CA'),
  ('19313', 'EC', 'Emma Chen', 'F', '5m', '19313', 'en', '[{"code":"CIS-CMB10","status":"Open","startDate":"10/01/2026"}]'::jsonb, NULL, NULL, '10/01/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 301-9313', '05/27/2026', 'Astrana', 'HP-001', '90012', 'Los Angeles', 'CA')
ON CONFLICT (id) DO UPDATE SET age = EXCLUDED.age, dob = EXCLUDED.dob, gaps = EXCLUDED.gaps, start_date = EXCLUDED.start_date;

-- Start from a blank Vaccine Calendar.
DELETE FROM public.patient_immunizations WHERE patient_id IN ('19309', '19310', '19311', '19312', '19313');

COMMIT;
