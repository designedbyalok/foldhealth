-- Program eligibility (DEV). Generated from
-- src/features/patient/data/programEligibilitySeed.js: William Davis and
-- Annette Brave. Run after program_eligibility_migration.sql. Re-running
-- updates the rows.

INSERT INTO public.program_eligibility (id, member_id, code, fit, why) VALUES
  ('pe-11143-DM', '11143', 'DM', 'eligible', 'Heart failure with a recent admission (St. Mary Hospital, discharged 11/08) and CKD stage 3b. Disease Management adds the CHF and kidney assessments.'),
  ('pe-11143-HICM', '11143', 'HICM', 'check', 'High-risk discharge score and weight up 4 lb in 3 days. HICM needs 2 admissions in 12 months; only this one is on file, so confirm with Dr. L. Chen.'),
  ('pe-11143-AWV', '11143', 'AWV', 'eligible', 'No Annual Wellness Visit on file for 2026. Medicare covers one every 12 months.'),
  ('pe-11089-TOC-ED', '11089', 'TOC ED', 'eligible', 'ED visit for chest pain at City Medical ER on 11/10 (ACS ruled out). TOC ED covers the 7-day follow-up and the new ER medications.'),
  ('pe-11089-PHARM', '11089', 'PHARM', 'eligible', 'Started aspirin and nitroglycerin in the ER on top of lisinopril and metformin. A pharmacist review checks the new list and how she takes them.')
ON CONFLICT (id) DO UPDATE SET
  member_id = EXCLUDED.member_id, code = EXCLUDED.code, fit = EXCLUDED.fit, why = EXCLUDED.why, checked_at = now();
