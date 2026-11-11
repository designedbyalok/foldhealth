-- Demo: open work for Aditi Kalegaonkar so every card in Reassign Open Work
-- (step 2 of an Out of Office record) has something in it, for an OOO
-- around 11/10-11/25/2026: 8 booked appointments at her two locations,
-- 4 care program enrollments she's the assignee of, and an Out of Office
-- phone tree on call schedule (Gaurav Gangurde, every location). Her tasks
-- are in ooo_demo_tasks_seed.sql.
-- Run on dev, then prod. Safe to re-run (fixed ids, ON CONFLICT DO NOTHING).

WITH aditi AS (SELECT id, trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'aditi%kalegaonkar%' LIMIT 1)
INSERT INTO public.appointments (id, patient_id, patient_name, appointment_type_id, appointment_type_name, mode, location, primary_user, primary_user_id, secondary_users, date, time_start, time_end, reason_for_visit, member_instruction, staff_instruction, require_rsvp, recurring, status, created_at, updated_at)
SELECT v.id::uuid, v.patient_id, v.patient_name, v.type_id::uuid, v.type_name, v.mode, v.location, aditi.name, aditi.id, '{}', v.date, v.ts, v.te, '', '', '', false, false, 'Scheduled', now(), now()
FROM aditi, (VALUES
  ('d1dcc7e1-a483-482c-9c08-692451b11d21', '11039', 'James Rivera',   '28f901b3-cc4b-42b2-8e20-87ba7adc35b5', 'Annual Wellness Visit',    'At Clinic', 'AstranaCare Centennial Hills', '11-12-2026', '9:00 am',  '9:30 am'),
  ('8dae50b8-b49d-43ed-84c5-e357b2665460', '10996', 'Kendra Crona',   'befbd1ac-f0ea-4655-9247-70c91ee3e43a', 'Follow-up Appointment',    'Virtual',   'AstranaCare Centennial Hills', '11-12-2026', '11:00 am', '11:30 am'),
  ('2373f50d-5995-470e-b538-86be36bf3d8c', '10985', 'Diana Welch',    '81a1da53-7e2b-4614-a4d2-becba4ccbc3a', 'Telehealth Consultation',  'Virtual',   'Palm Health Centre',           '11-13-2026', '10:00 am', '10:30 am'),
  ('809cfc11-4219-43a7-a843-5bbaa618f51e', '11058', 'Brian Thompson', 'ff869a5e-e1c8-45eb-b00c-8bed7b4cf2cb', 'Lab Results Discussion',   'Virtual',   'Palm Health Centre',           '11-16-2026', '2:00 pm',  '2:30 pm'),
  ('121ea631-0b5f-4f5f-982d-cdfb8181b813', '11119', 'Maria Lopez',    '0947c079-5f5b-45e6-98d9-b6772d77eec9', 'Specialty Consultation',   'In-person', 'AstranaCare Centennial Hills', '11-17-2026', '9:30 am',  '10:00 am'),
  ('a32b1b49-a056-48d9-a8f4-0c0542f7b748', '11053', 'Elena Garcia',   '28f901b3-cc4b-42b2-8e20-87ba7adc35b5', 'Annual Wellness Visit',    'At Clinic', 'Palm Health Centre',           '11-18-2026', '3:00 pm',  '3:30 pm'),
  ('a75362de-9eff-48e6-ad22-a65e71cf5454', '11135', 'Mary Thompson',  'befbd1ac-f0ea-4655-9247-70c91ee3e43a', 'Follow-up Appointment',    'Virtual',   'AstranaCare Centennial Hills', '11-19-2026', '1:00 pm',  '1:30 pm'),
  ('6cb7dbeb-2f0b-4591-a0ad-aa5124dcaa57', '11187', 'Alice Walker',   '81a1da53-7e2b-4614-a4d2-becba4ccbc3a', 'Telehealth Consultation',  'Virtual',   'Palm Health Centre',           '11-21-2026', '11:00 am', '11:30 am')
) AS v(id, patient_id, patient_name, type_id, type_name, mode, location, date, ts, te)
ON CONFLICT (id) DO NOTHING;

WITH aditi AS (SELECT trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'aditi%kalegaonkar%' LIMIT 1)
INSERT INTO public.patient_care_programs (id, patient_id, code, name, status, start_date, assignee, created_at)
SELECT v.id, v.patient_id, v.code, v.name, 'Enrolled', v.start_date, aditi.name, now()
FROM aditi, (VALUES
  ('pcp-ooo-demo-aditi-1', '11160', 'CCM', 'Chronic Care Management (CCM)',      '09-15-2026'),
  ('pcp-ooo-demo-aditi-2', '11171', 'PCM', 'Principal Care Management (PCM)',    '10-01-2026'),
  ('pcp-ooo-demo-aditi-3', '11100', 'TCM', 'Transitional Care Management (TCM)', '10-28-2026'),
  ('pcp-ooo-demo-aditi-4', '10979', 'CCM', 'Chronic Care Management (CCM)',      '08-20-2026')
) AS v(id, patient_id, code, name, start_date)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.on_call_schedules (id, name, phone_tree_type, from_date, to_date, days, user_name, user_id, created_by, created_at)
SELECT 'oncall-demo-ooo-nov', 'November OOO phone tree', 'Out of Office', '2026-11-01', '2026-11-30', '{0,1,2,3,4,5,6}', trim(p.full_name), p.id, 'Devanshi Sharma', now()
FROM (SELECT id, full_name FROM public.profiles WHERE full_name ILIKE 'gaurav%gangurde%' LIMIT 1) p
ON CONFLICT (id) DO NOTHING;
