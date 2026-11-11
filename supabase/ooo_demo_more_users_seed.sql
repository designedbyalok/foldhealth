-- Demo: open work for more users, so marking any of them out of office shows
-- every Reassign Open Work card (appointments at their locations, Care Plan
-- Review / Med Recon Review / other tasks, care programs):
--   Abhijit Gupta (7 Hills Department, Adrian Health Partners): 11/17-11/26/2026
--   Amar Jagtap (Mary Health, Riverside Clinic): his OOO record, 11/16-11/20/2026
--   Ajay Lakshman (Carson City Center, Mary Health): his OOO record, through 11/12/2026
-- Run on dev, then prod. Safe to re-run (fixed ids / source keys).

-- Abhijit Gupta
WITH p AS (SELECT id, trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'abhijit%gupta%' LIMIT 1)
INSERT INTO public.appointments (id, patient_id, patient_name, appointment_type_id, appointment_type_name, mode, location, primary_user, primary_user_id, secondary_users, date, time_start, time_end, reason_for_visit, member_instruction, staff_instruction, require_rsvp, recurring, status, created_at, updated_at)
SELECT v.id::uuid, v.patient_id, v.patient_name, v.type_id::uuid, v.type_name, v.mode, v.location, p.name, p.id, '{}', v.date, v.ts, v.te, '', '', '', false, false, 'Scheduled', now(), now()
FROM p, (VALUES
  ('4f975378-d05b-4692-9a22-7e3700b74cea', '11145', 'Lisa Brown', '28f901b3-cc4b-42b2-8e20-87ba7adc35b5', 'Annual Wellness Visit', 'At Clinic', '7 Hills Department', '11-18-2026', '9:00 am', '9:30 am'),
  ('ef26f885-d679-42bd-b800-af0faada5bed', '10972', 'Robert Johnson', 'befbd1ac-f0ea-4655-9247-70c91ee3e43a', 'Follow-up Appointment', 'Virtual', 'Adrian Health Partners', '11-19-2026', '11:00 am', '11:30 am'),
  ('e93e1fcf-fcbe-4ab5-a76b-48600e0ae355', '11139', 'Peter Kim', '81a1da53-7e2b-4614-a4d2-becba4ccbc3a', 'Telehealth Consultation', 'Virtual', '7 Hills Department', '11-23-2026', '10:00 am', '10:30 am'),
  ('caaa69e3-63d6-4561-a83e-baa58af55458', '10999', 'Angela Foster', 'ff869a5e-e1c8-45eb-b00c-8bed7b4cf2cb', 'Lab Results Discussion', 'Virtual', 'Adrian Health Partners', '11-25-2026', '2:00 pm', '2:30 pm')
) AS v(id, patient_id, patient_name, type_id, type_name, mode, location, date, ts, te)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tasks (name, status, priority, due_date, due_missed, member, patient_id, labels, assigned_to, assigned_to_id, description, created_by, created_at, updated_at, is_subtask, attachments, comments, mentions, source_key)
SELECT v.name, v.status, v.priority, v.due, v.status = 'missed', v.patient, v.patient_id, v.labels, trim(pr.full_name), pr.id,
       v.name || '.', 'Devanshi Sharma', now(), now(), false, 0, 0, '{}', v.source_key
FROM (VALUES
  ('Review care plan for Lisa Brown', 'pending', 'high', '11-20-2026', ARRAY['Care Plan Review'], 'Lisa Brown', '11145', 'ooo-demo-abhijit-1'),
  ('Med Recon review for Robert Johnson', 'missed', 'high', '11-09-2026', ARRAY['Med Recon Review'], 'Robert Johnson', '10972', 'ooo-demo-abhijit-2'),
  ('Follow up on imaging results', 'pending', 'medium', '11-22-2026', ARRAY['Follow-up'], 'Peter Kim', '11139', 'ooo-demo-abhijit-3'),
  ('Update care team contacts', 'pending', 'low', '11-25-2026', ARRAY['Admin'], 'Angela Foster', '10999', 'ooo-demo-abhijit-4')
) AS v(name, status, priority, due, labels, patient, patient_id, source_key)
JOIN LATERAL (SELECT id, full_name FROM public.profiles WHERE full_name ILIKE 'abhijit%gupta%' LIMIT 1) pr ON true
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.source_key = v.source_key);

WITH p AS (SELECT trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'abhijit%gupta%' LIMIT 1)
INSERT INTO public.patient_care_programs (id, patient_id, code, name, status, start_date, assignee, created_at)
SELECT v.id, v.patient_id, v.code, v.name, 'Enrolled', v.start_date, p.name, now()
FROM p, (VALUES
  ('pcp-ooo-demo-abhijit-1', '11145', 'CCM', 'Chronic Care Management (CCM)', '08-15-2026'),
  ('pcp-ooo-demo-abhijit-2', '10999', 'PCM', 'Principal Care Management (PCM)', '10-05-2026')
) AS v(id, patient_id, code, name, start_date)
ON CONFLICT (id) DO NOTHING;

-- Amar Jagtap
WITH p AS (SELECT id, trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'amar%jagtap%' LIMIT 1)
INSERT INTO public.appointments (id, patient_id, patient_name, appointment_type_id, appointment_type_name, mode, location, primary_user, primary_user_id, secondary_users, date, time_start, time_end, reason_for_visit, member_instruction, staff_instruction, require_rsvp, recurring, status, created_at, updated_at)
SELECT v.id::uuid, v.patient_id, v.patient_name, v.type_id::uuid, v.type_name, v.mode, v.location, p.name, p.id, '{}', v.date, v.ts, v.te, '', '', '', false, false, 'Scheduled', now(), now()
FROM p, (VALUES
  ('e695e987-d64d-4727-9e2f-2b440d7bdda0', '11020', 'Ralph Halvorson', '28f901b3-cc4b-42b2-8e20-87ba7adc35b5', 'Annual Wellness Visit', 'At Clinic', 'Mary Health', '11-16-2026', '9:30 am', '10:00 am'),
  ('aad7a806-8379-4db0-8e1d-37f850d6c0e3', '11196', 'Ketan Patni', 'befbd1ac-f0ea-4655-9247-70c91ee3e43a', 'Follow-up Appointment', 'Virtual', 'Riverside Clinic', '11-17-2026', '1:00 pm', '1:30 pm'),
  ('e52745bb-1050-4b06-b4ac-be3af74802e4', '11089', 'Annette Brave', '81a1da53-7e2b-4614-a4d2-becba4ccbc3a', 'Telehealth Consultation', 'Virtual', 'Mary Health', '11-18-2026', '11:00 am', '11:30 am'),
  ('d0da1dce-f53d-4d44-8e5b-81ed2f0dd871', '10951', 'Sandra Nguyen', 'ff869a5e-e1c8-45eb-b00c-8bed7b4cf2cb', 'Lab Results Discussion', 'Virtual', 'Riverside Clinic', '11-20-2026', '3:00 pm', '3:30 pm')
) AS v(id, patient_id, patient_name, type_id, type_name, mode, location, date, ts, te)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tasks (name, status, priority, due_date, due_missed, member, patient_id, labels, assigned_to, assigned_to_id, description, created_by, created_at, updated_at, is_subtask, attachments, comments, mentions, source_key)
SELECT v.name, v.status, v.priority, v.due, v.status = 'missed', v.patient, v.patient_id, v.labels, trim(pr.full_name), pr.id,
       v.name || '.', 'Devanshi Sharma', now(), now(), false, 0, 0, '{}', v.source_key
FROM (VALUES
  ('Review care plan for Ralph Halvorson', 'pending', 'medium', '11-17-2026', ARRAY['Care Plan Review'], 'Ralph Halvorson', '11020', 'ooo-demo-amar-1'),
  ('Review care plan for Annette Brave', 'missed', 'high', '11-07-2026', ARRAY['Care Plan Review'], 'Annette Brave', '11089', 'ooo-demo-amar-2'),
  ('Med Recon review for Ketan Patni', 'pending', 'high', '11-18-2026', ARRAY['Med Recon Review'], 'Ketan Patni', '11196', 'ooo-demo-amar-3'),
  ('Call patient to confirm referral', 'pending', 'low', '11-19-2026', ARRAY['Outreach'], 'Sandra Nguyen', '10951', 'ooo-demo-amar-4')
) AS v(name, status, priority, due, labels, patient, patient_id, source_key)
JOIN LATERAL (SELECT id, full_name FROM public.profiles WHERE full_name ILIKE 'amar%jagtap%' LIMIT 1) pr ON true
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.source_key = v.source_key);

WITH p AS (SELECT trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'amar%jagtap%' LIMIT 1)
INSERT INTO public.patient_care_programs (id, patient_id, code, name, status, start_date, assignee, created_at)
SELECT v.id, v.patient_id, v.code, v.name, 'Enrolled', v.start_date, p.name, now()
FROM p, (VALUES
  ('pcp-ooo-demo-amar-1', '11196', 'TCM', 'Transitional Care Management (TCM)', '11-02-2026'),
  ('pcp-ooo-demo-amar-2', '11020', 'CCM', 'Chronic Care Management (CCM)', '09-20-2026')
) AS v(id, patient_id, code, name, start_date)
ON CONFLICT (id) DO NOTHING;

-- Ajay Lakshman
WITH p AS (SELECT id, trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'ajay%lakshman%' LIMIT 1)
INSERT INTO public.appointments (id, patient_id, patient_name, appointment_type_id, appointment_type_name, mode, location, primary_user, primary_user_id, secondary_users, date, time_start, time_end, reason_for_visit, member_instruction, staff_instruction, require_rsvp, recurring, status, created_at, updated_at)
SELECT v.id::uuid, v.patient_id, v.patient_name, v.type_id::uuid, v.type_name, v.mode, v.location, p.name, p.id, '{}', v.date, v.ts, v.te, '', '', '', false, false, 'Scheduled', now(), now()
FROM p, (VALUES
  ('7f42f92d-f478-47a1-9c98-8301b7e5edfd', '11052', 'Alok Kumar', 'befbd1ac-f0ea-4655-9247-70c91ee3e43a', 'Follow-up Appointment', 'Virtual', 'Carson City Center', '11-12-2026', '9:00 am', '9:30 am'),
  ('b25f2fe5-c856-4388-b0af-720fef835a36', '11160', 'Ms. Lloyd Pagac', '81a1da53-7e2b-4614-a4d2-becba4ccbc3a', 'Telehealth Consultation', 'Virtual', 'Mary Health', '11-12-2026', '11:00 am', '11:30 am'),
  ('d41799c2-5634-4d8d-8676-70a1bf99aabe', '11171', 'Glenn Bauch', 'ff869a5e-e1c8-45eb-b00c-8bed7b4cf2cb', 'Lab Results Discussion', 'Virtual', 'Carson City Center', '11-12-2026', '2:00 pm', '2:30 pm'),
  ('2024b376-d1db-43bf-9331-81c74e847f76', '11100', 'James Anderson', '28f901b3-cc4b-42b2-8e20-87ba7adc35b5', 'Annual Wellness Visit', 'At Clinic', 'Mary Health', '11-12-2026', '4:00 pm', '4:30 pm')
) AS v(id, patient_id, patient_name, type_id, type_name, mode, location, date, ts, te)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tasks (name, status, priority, due_date, due_missed, member, patient_id, labels, assigned_to, assigned_to_id, description, created_by, created_at, updated_at, is_subtask, attachments, comments, mentions, source_key)
SELECT v.name, v.status, v.priority, v.due, v.status = 'missed', v.patient, v.patient_id, v.labels, trim(pr.full_name), pr.id,
       v.name || '.', 'Devanshi Sharma', now(), now(), false, 0, 0, '{}', v.source_key
FROM (VALUES
  ('Review care plan for Glenn Bauch', 'pending', 'high', '11-12-2026', ARRAY['Care Plan Review'], 'Glenn Bauch', '11171', 'ooo-demo-ajay-1'),
  ('Med Recon review for James Anderson', 'missed', 'medium', '11-06-2026', ARRAY['Med Recon Review'], 'James Anderson', '11100', 'ooo-demo-ajay-2'),
  ('Send visit summary', 'pending', 'low', '11-12-2026', ARRAY['Admin'], 'Alok Kumar', '11052', 'ooo-demo-ajay-3')
) AS v(name, status, priority, due, labels, patient, patient_id, source_key)
JOIN LATERAL (SELECT id, full_name FROM public.profiles WHERE full_name ILIKE 'ajay%lakshman%' LIMIT 1) pr ON true
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.source_key = v.source_key);

WITH p AS (SELECT trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'ajay%lakshman%' LIMIT 1)
INSERT INTO public.patient_care_programs (id, patient_id, code, name, status, start_date, assignee, created_at)
SELECT v.id, v.patient_id, v.code, v.name, 'Enrolled', v.start_date, p.name, now()
FROM p, (VALUES
  ('pcp-ooo-demo-ajay-1', '11052', 'CCM', 'Chronic Care Management (CCM)', '09-10-2026')
) AS v(id, patient_id, code, name, start_date)
ON CONFLICT (id) DO NOTHING;
