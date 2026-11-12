-- Care program suggested actions (DEV). Generated from
-- src/features/patient/data/programEventSuggestionsSeed.js: William Davis and
-- Annette Brave. Run after program_event_suggestions_migration.sql.
-- Re-running resets the rows to open.

INSERT INTO public.program_event_suggestions (id, member_id, event_kind, event_title, event_detail, event_source, occurred_at, program_code, suggestion, action) VALUES
  ('pes-11143-adt', '11143', 'adt', 'Inpatient discharge', 'St. Mary Hospital · CHF exacerbation', 'ADT feed', '11/08/2026', 'TOC IP', 'Complete the 2-day interactive contact. It was due Tue 11/10; agent calls don’t count toward TCM.', '{"type":"step","code":"TOC IP","step":"Outreach"}'::jsonb),
  ('pes-11143-efax', '11143', 'efax', 'Discharge summary received', 'St. Mary Hospital · 6 pages', 'eFax', '11/09/2026', 'TOC IP', 'File the discharge summary in TOC IP program documents and reconcile its medication list (furosemide stopped, torsemide 40 mg started).', '{"type":"step","code":"TOC IP","step":"Program Documents"}'::jsonb),
  ('pes-11143-imaging', '11143', 'imaging', 'Chest X-ray', 'Mild pulmonary edema, improved from admission', 'St. Mary Radiology', '11/07/2026', 'TOC IP', 'Ask Dr. Chen whether a repeat chest X-ray is needed at the 7-day visit.', '{"type":"task","code":"TOC IP","name":"Ask Dr. L. Chen about a repeat chest X-ray at the 7-day visit","due":"11-13-2026","priority":"medium"}'::jsonb),
  ('pes-11143-lab', '11143', 'lab', 'BNP 890 pg/mL', 'High · reference under 100', 'St. Mary Lab', '11/07/2026', 'DM', 'Heart failure with a recent admission: enroll in Disease Management for the CHF assessment and daily-weight follow-up.', '{"type":"enroll","code":"DM"}'::jsonb),
  ('pes-11089-adt', '11089', 'adt', 'ED discharge', 'City Medical ER · chest pain, ACS ruled out', 'ADT feed', '11/10/2026', 'TOC ED', 'Enroll in TOC ED for the 7-day ED follow-up (due by 11/17) and the new ER medications.', '{"type":"enroll","code":"TOC ED"}'::jsonb),
  ('pes-11089-efax', '11089', 'efax', 'ED visit summary received', 'City Medical ER · 3 pages', 'eFax', '11/11/2026', 'TOC IP', 'File the ED summary in TOC IP program documents; it lists aspirin 81 mg and nitroglycerin as new.', '{"type":"step","code":"TOC IP","step":"Program Documents"}'::jsonb),
  ('pes-11089-lab', '11089', 'lab', 'Potassium 5.3 mmol/L', 'High · reference 3.5 to 5.0', 'City Medical Lab', '11/10/2026', 'DM', 'She takes lisinopril: recheck potassium within a week, with the fasting labs on 11/13.', '{"type":"task","code":"DM","name":"Add a potassium recheck to the fasting labs on 11/13","due":"11-12-2026","priority":"high"}'::jsonb),
  ('pes-11089-imaging', '11089', 'imaging', 'Chest X-ray', 'No acute findings', 'City Medical Radiology', '11/10/2026', 'TOC IP', 'No follow-up needed. Mention the normal result at the 7-day visit.', '{"type":"review"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  member_id = EXCLUDED.member_id, event_kind = EXCLUDED.event_kind, event_title = EXCLUDED.event_title,
  event_detail = EXCLUDED.event_detail, event_source = EXCLUDED.event_source, occurred_at = EXCLUDED.occurred_at,
  program_code = EXCLUDED.program_code, suggestion = EXCLUDED.suggestion, action = EXCLUDED.action,
  status = 'open', decided_by = NULL, decided_at = NULL;
