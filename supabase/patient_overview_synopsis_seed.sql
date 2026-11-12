-- Patient Synopsis (DEV): a synopsis for William Davis (none before) and
-- Annette Brave's brought up to date with her TOC record (age 61, ED visit
-- for chest pain on 11/10/2026). Annette's lab values stay as her overview's
-- vitals show them, so the synopsis never contradicts the cards beside it.
-- Only the synopsis fields change on an existing row.

INSERT INTO public.patient_overview (member_id, synopsis, synopsis_emphasis, takeaways, sources_count, generated_at, health_scores, highlights, suggested_actions, vitals, gaps)
VALUES (
  '11143',
  'William is a 77-year-old man with heart failure and CKD stage 3b, discharged from St. Mary Hospital on 11/08/2026 after a CHF admission. His weight is up 4 lb in 3 days, and he is unsure of the new torsemide dose. His 2-day TCM contact is overdue and medication reconciliation is pending.',
  '["4 lb in 3 days", "torsemide", "overdue"]'::jsonb,
  '[
    {"tone":"error","text":"Weight up 4 lb in 3 days since the 11/08 discharge"},
    {"tone":"warning","text":"Unsure of the new torsemide dose; medication reconciliation pending"},
    {"tone":"warning","text":"2-day TCM contact overdue; 7-day visit due by 11/15"}
  ]'::jsonb,
  9, now(), '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
)
ON CONFLICT (member_id) DO UPDATE SET
  synopsis = EXCLUDED.synopsis, synopsis_emphasis = EXCLUDED.synopsis_emphasis,
  takeaways = EXCLUDED.takeaways, sources_count = EXCLUDED.sources_count, generated_at = EXCLUDED.generated_at;

UPDATE public.patient_overview SET
  synopsis = 'Annette is a 61-year-old woman with Type 2 Diabetes, Hypertension, COPD and Hyperlipidemia. She was seen in the City Medical ER on 11/10/2026 for chest pain; ACS was ruled out and she started aspirin and nitroglycerin. HbA1c is 8.2% (goal under 7.0%) and blood pressure 142/88 mmHg.',
  synopsis_emphasis = '["11/10/2026", "8.2%", "142/88 mmHg"]'::jsonb,
  takeaways = '[
    {"tone":"error","text":"ED visit for chest pain on 11/10; 7-day follow-up due by 11/17"},
    {"tone":"warning","text":"HbA1c 8.2%, above the under 7.0% goal"},
    {"tone":"warning","text":"2 missed PHQ-9 screenings; care plan adherence at 70%"}
  ]'::jsonb,
  generated_at = now()
WHERE member_id = '11089';
