-- Care Programs demo records for Annette Brave (Fold ID 11089), so Next Best
-- Actions reads like a real transition of care (DEV). Safe to re-run: rows
-- are matched by name / source_key / primary key.
--
-- The story: 61-year-old with type 2 diabetes, hypertension and COPD.
-- Admitted to City Medical Center 11/03/2026 for a COPD exacerbation,
-- discharged 11/06 on a prednisone taper (TOC IP trigger). Seen in the City
-- Medical ER 11/10 for chest pain, ACS ruled out, started aspirin and
-- nitroglycerin. Potassium 5.3 on lisinopril. Her only visit on the books is
-- a telehealth visit on 11/18, after the 7-day follow-up window (11/13).

-- TOC IP enrollment: the discharge that started it.
UPDATE public.patient_care_programs
   SET trigger_type = 'Inpatient discharge', trigger_date = '11/06/2026'
 WHERE id = 'pcp-p3-TOC IP' AND patient_id = '11089';

-- Medication list (chronic, then discharge and ER additions).
INSERT INTO public.patient_medications (patient_id, name, sig, start_date, stop_date, source, status, note)
SELECT v.patient_id, v.name, v.sig, v.start_date, v.stop_date, v.source, 'Active', v.note
FROM (VALUES
  ('11089', 'Lisinopril 20 mg tablet', '1 tablet by mouth once daily', '2024-03-12', NULL, 'manual', NULL),
  ('11089', 'Metformin 1000 mg tablet', '1 tablet by mouth twice daily with meals', '2022-06-01', NULL, 'manual', NULL),
  ('11089', 'Atorvastatin 40 mg tablet', '1 tablet by mouth nightly', '2023-01-15', NULL, 'manual', NULL),
  ('11089', 'Tiotropium 18 mcg inhalation capsule', 'Inhale the contents of 1 capsule once daily', '2025-02-10', NULL, 'manual', NULL),
  ('11089', 'Albuterol HFA 90 mcg/actuation inhaler', '2 puffs every 4 to 6 hours as needed for wheezing', '2025-02-10', NULL, 'manual', NULL),
  ('11089', 'Prednisone 10 mg tablet', '40 mg daily for 2 days, then lower by 10 mg every 2 days', '2026-11-06', '2026-11-14', 'discharge_import', 'From the City Medical Center discharge summary, 11/06/2026.'),
  ('11089', 'Aspirin 81 mg delayed-release tablet', '1 tablet by mouth once daily', '2026-11-10', NULL, 'manual', 'Started in the City Medical ER, 11/10/2026.'),
  ('11089', 'Nitroglycerin 0.4 mg sublingual tablet', '1 tablet under the tongue every 5 minutes as needed for chest pain, up to 3', '2026-11-10', NULL, 'manual', 'Started in the City Medical ER, 11/10/2026.')
) AS v(patient_id, name, sig, start_date, stop_date, source, note)
WHERE NOT EXISTS (SELECT 1 FROM public.patient_medications m WHERE m.patient_id = v.patient_id AND m.name = v.name);

-- Program tasks (Alok Kumar, the demo care manager).
INSERT INTO public.tasks (name, description, status, priority, due_date, member, patient_id, program_code,
                          assigned_to, assigned_to_id, created_by, created_by_id, labels, mentions, attachments, comments, is_subtask, source_key)
SELECT v.name, v.description, 'pending', v.priority, v.due_date, 'Annette Brave', '11089', v.program_code,
       'Alok Kumar', '838be513-f13e-488d-9e40-61791fc8cd65', 'Alok Kumar', '838be513-f13e-488d-9e40-61791fc8cd65',
       '{}', '{}', 0, 0, false, v.source_key
FROM (VALUES
  ('Confirm prednisone taper and inhaler technique by phone', 'Discharged 11/06 on a prednisone taper; check she is following it and using tiotropium and albuterol correctly.', 'high', '11-11-2026', 'TOC IP', 'demo-nba-11089-tocip-taper'),
  ('Recheck potassium with the fasting labs', 'Potassium 5.3 mmol/L on lisinopril (City Medical Lab, 11/10). Add a BMP to the 11/13 fasting draw.', 'high', '11-13-2026', 'DM', 'demo-nba-11089-dm-potassium'),
  ('Review the 11/10 ER visit with the PCP', 'Second ED visit in 30 days (chest pain, ACS ruled out). Discuss with Dr. Chen and update the HICM plan.', 'medium', '11-14-2026', 'HICM', 'demo-nba-11089-hicm-er'),
  ('Monthly check-in: review the home glucose log', 'A1C 7.4% (09/24). Review fasting readings since the prednisone course.', 'medium', '11-20-2026', 'CCM', 'demo-nba-11089-ccm-glucose')
) AS v(name, description, priority, due_date, program_code, source_key)
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.source_key = v.source_key);

-- Steps already done: the snapshots reviewed and letters sent at enrollment,
-- and the TOC interactive contact (11/09, within 2 business days).
INSERT INTO public.care_program_step_status (patient_program_id, step_id, step_name, status, updated_by)
VALUES
  ('pcp-p3-TOC IP', 'tocip-snapshot', 'Snapshot', 'completed', 'Alok Kumar'),
  ('pcp-p3-TOC IP', 'tocip-outreach', 'Outreach', 'completed', 'Alok Kumar'),
  ('pcp-p3-DM', 'dm-snapshot', 'Snapshot', 'completed', 'Alok Kumar'),
  ('pcp-p3-DM', 'dm-letters', 'Letters', 'completed', 'Alok Kumar'),
  ('pcp-11089-HICM', 'hicm-snapshot', 'Snapshot', 'completed', 'Alok Kumar'),
  ('pcp-11089-HICM', 'hicm-letters', 'Letters', 'completed', 'Alok Kumar'),
  ('pcp-snpw-001-SNP-1', 'step-2', 'Letters', 'completed', 'Alok Kumar')
ON CONFLICT (patient_program_id, step_id) DO UPDATE SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now();
