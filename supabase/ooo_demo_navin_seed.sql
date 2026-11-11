-- Demo: open work for Navin Jethwani (Carson City Center, Home Health
-- Centre), so marking him out of office around 11/16-11/27/2026 shows every
-- Reassign Open Work card: 8 booked appointments at his two locations, Care
-- Plan Review / Med Recon Review / other tasks (two of them missed), and 3
-- care program enrollments. Tasks and programs take their department from
-- the patient's appointment until tasks_location_migration.sql sets it.
-- Run on dev, then prod. Safe to re-run (fixed ids / source keys).

WITH navin AS (SELECT id, trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'navin%jethwani%' LIMIT 1)
INSERT INTO public.appointments (id, patient_id, patient_name, appointment_type_id, appointment_type_name, mode, location, primary_user, primary_user_id, secondary_users, date, time_start, time_end, reason_for_visit, member_instruction, staff_instruction, require_rsvp, recurring, status, created_at, updated_at)
SELECT v.id::uuid, v.patient_id, v.patient_name, v.type_id::uuid, v.type_name, v.mode, v.location, navin.name, navin.id, '{}', v.date, v.ts, v.te, '', '', '', false, false, 'Scheduled', now(), now()
FROM navin, (VALUES
  ('765913a9-255c-4fa7-a25e-b542e78d4bd2', '11060', 'Carlos Hernandez', '28f901b3-cc4b-42b2-8e20-87ba7adc35b5', 'Annual Wellness Visit',   'At Clinic', 'Carson City Center', '11-17-2026', '9:00 am',  '9:30 am'),
  ('631ad006-e7e4-4b26-a592-08810d4116f1', '11113', 'Terri Schulist',   'befbd1ac-f0ea-4655-9247-70c91ee3e43a', 'Follow-up Appointment',   'Virtual',   'Home Health Centre', '11-17-2026', '11:00 am', '11:30 am'),
  ('9724b41f-2653-4984-8ff0-29095b39f7ab', '11193', 'Jennifer Chen',    '81a1da53-7e2b-4614-a4d2-becba4ccbc3a', 'Telehealth Consultation', 'Virtual',   'Carson City Center', '11-18-2026', '10:00 am', '10:30 am'),
  ('427233a1-5936-4fc1-9de9-35c74864f3b0', '11191', 'Thomas Moore',     'ff869a5e-e1c8-45eb-b00c-8bed7b4cf2cb', 'Lab Results Discussion',  'Virtual',   'Home Health Centre', '11-19-2026', '2:00 pm',  '2:30 pm'),
  ('c5d61f49-fa60-4947-a092-e501fffdcbc3', '11013', 'David Ortiz',      '0947c079-5f5b-45e6-98d9-b6772d77eec9', 'Specialty Consultation',  'In-person', 'Carson City Center', '11-20-2026', '9:30 am',  '10:00 am'),
  ('1a8c0c1f-1e0b-42c7-bae4-6e203e491d98', '11050', 'Ricardo Martinez', '28f901b3-cc4b-42b2-8e20-87ba7adc35b5', 'Annual Wellness Visit',   'At Clinic', 'Home Health Centre', '11-23-2026', '3:00 pm',  '3:30 pm'),
  ('31326293-6fb9-4187-9661-606c0ef4a708', '11045', 'Helen Jackson',    'befbd1ac-f0ea-4655-9247-70c91ee3e43a', 'Follow-up Appointment',   'Virtual',   'Carson City Center', '11-24-2026', '1:00 pm',  '1:30 pm'),
  ('da33c8be-a0a0-4d4f-a029-95bcb9b71d8a', '11143', 'William Davis',    '81a1da53-7e2b-4614-a4d2-becba4ccbc3a', 'Telehealth Consultation', 'Virtual',   'Home Health Centre', '11-25-2026', '11:00 am', '11:30 am')
) AS v(id, patient_id, patient_name, type_id, type_name, mode, location, date, ts, te)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tasks (name, status, priority, due_date, due_missed, member, patient_id, labels, assigned_to, assigned_to_id, description, created_by, created_at, updated_at, is_subtask, attachments, comments, mentions, source_key)
SELECT v.name, v.status, v.priority, v.due, v.status = 'missed', v.patient, v.patient_id, v.labels, trim(pr.full_name), pr.id,
       v.name || '.', 'Devanshi Sharma', now(), now(), false, 0, 0, '{}', v.source_key
FROM (VALUES
  ('Review care plan for Carlos Hernandez', 'pending', 'high',   '11-18-2026', ARRAY['Care Plan Review'], 'Carlos Hernandez', '11060', 'ooo-demo-navin-1'),
  ('Review care plan for Jennifer Chen',    'pending', 'medium', '11-21-2026', ARRAY['Care Plan Review'], 'Jennifer Chen',    '11193', 'ooo-demo-navin-2'),
  ('Review care plan for Helen Jackson',    'missed',  'medium', '11-09-2026', ARRAY['Care Plan Review'], 'Helen Jackson',    '11045', 'ooo-demo-navin-3'),
  ('Med Recon review for Terri Schulist',   'pending', 'high',   '11-19-2026', ARRAY['Med Recon Review'], 'Terri Schulist',   '11113', 'ooo-demo-navin-4'),
  ('Med Recon review for Thomas Moore',     'missed',  'high',   '11-08-2026', ARRAY['Med Recon Review'], 'Thomas Moore',     '11191', 'ooo-demo-navin-5'),
  ('Follow up on lab results',              'pending', 'medium', '11-20-2026', ARRAY['Follow-up'],        'David Ortiz',      '11013', 'ooo-demo-navin-6'),
  ('Schedule annual wellness visit',        'pending', 'low',    '11-24-2026', ARRAY['AWV'],              'Ricardo Martinez', '11050', 'ooo-demo-navin-7'),
  ('Prior authorization paperwork',         'pending', 'medium', '11-26-2026', ARRAY['Admin'],            'William Davis',    '11143', 'ooo-demo-navin-8')
) AS v(name, status, priority, due, labels, patient, patient_id, source_key)
JOIN LATERAL (SELECT id, full_name FROM public.profiles WHERE full_name ILIKE 'navin%jethwani%' LIMIT 1) pr ON true
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.source_key = v.source_key);

WITH navin AS (SELECT trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'navin%jethwani%' LIMIT 1)
INSERT INTO public.patient_care_programs (id, patient_id, code, name, status, start_date, assignee, created_at)
SELECT v.id, v.patient_id, v.code, v.name, 'Enrolled', v.start_date, navin.name, now()
FROM navin, (VALUES
  ('pcp-ooo-demo-navin-1', '11060', 'CCM', 'Chronic Care Management (CCM)',      '09-01-2026'),
  ('pcp-ooo-demo-navin-2', '11191', 'TCM', 'Transitional Care Management (TCM)', '10-30-2026'),
  ('pcp-ooo-demo-navin-3', '11050', 'PCM', 'Principal Care Management (PCM)',    '10-12-2026')
) AS v(id, patient_id, code, name, start_date)
ON CONFLICT (id) DO NOTHING;
