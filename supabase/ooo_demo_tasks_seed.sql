-- Demo: open tasks for Aditi Kalegaonkar and Abhay Chaudhary, so Reassign
-- Open Work (step 2 of an Out of Office record) has Care Plan Review, Med
-- Recon Review and other tasks to show. Due 11/05-11/24/2026; those before
-- 11/10 are missed. Run on dev, then prod. Safe to re-run (skips rows whose
-- source_key exists).

INSERT INTO public.tasks (name, status, priority, due_date, due_missed, member, patient_id, labels, assigned_to, assigned_to_id, description, created_by, created_at, updated_at, is_subtask, attachments, comments, mentions, source_key)
SELECT v.name, v.status, v.priority, v.due, v.status = 'missed', pt.name, pt.id, v.labels, trim(pr.full_name), pr.id,
       v.name || '.', 'Devanshi Sharma', now(), now(), false, 0, 0, '{}', v.source_key
FROM (VALUES
  ('Review care plan for James Rivera',    'pending', 'high',   '11-12-2026', ARRAY['Care Plan Review'], 'James Rivera',   'ooo-demo-aditi-1'),
  ('Review care plan for Diana Welch',     'pending', 'medium', '11-18-2026', ARRAY['Care Plan Review'], 'Diana Welch',    'ooo-demo-aditi-2'),
  ('Review care plan for Maria Lopez',     'missed',  'medium', '11-06-2026', ARRAY['Care Plan Review'], 'Maria Lopez',    'ooo-demo-aditi-3'),
  ('Med Recon review for Kendra Crona',    'pending', 'high',   '11-13-2026', ARRAY['Med Recon Review'], 'Kendra Crona',   'ooo-demo-aditi-4'),
  ('Med Recon review for Brian Thompson',  'missed',  'high',   '11-07-2026', ARRAY['Med Recon Review'], 'Brian Thompson', 'ooo-demo-aditi-5'),
  ('Follow up on lab results',             'pending', 'medium', '11-14-2026', ARRAY['Follow-up'],        'Elena Garcia',   'ooo-demo-aditi-6'),
  ('Call patient about missed appointment','missed',  'low',    '11-05-2026', ARRAY['Outreach'],         'Mary Thompson',  'ooo-demo-aditi-7'),
  ('Schedule annual wellness visit',       'pending', 'low',    '11-20-2026', ARRAY['AWV'],              'Alice Walker',   'ooo-demo-aditi-8'),
  ('Prior authorization paperwork',        'pending', 'medium', '11-24-2026', ARRAY['Admin'],            'James Rivera',   'ooo-demo-aditi-9')
) AS v(name, status, priority, due, labels, patient, source_key)
JOIN LATERAL (SELECT id, full_name FROM public.profiles WHERE full_name ILIKE 'aditi%kalegaonkar%' LIMIT 1) pr ON true
LEFT JOIN LATERAL (SELECT id, name FROM public.patients WHERE name = v.patient LIMIT 1) pt ON true
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.source_key = v.source_key);

-- Abhay Chaudhary: Care Plan Review and Med Recon Review tasks.
INSERT INTO public.tasks (name, status, priority, due_date, due_missed, member, patient_id, labels, assigned_to, assigned_to_id, description, created_by, created_at, updated_at, is_subtask, attachments, comments, mentions, source_key)
SELECT v.name, v.status, v.priority, v.due, v.status = 'missed', pt.name, pt.id, v.labels, trim(pr.full_name), pr.id,
       v.name || '.', 'Devanshi Sharma', now(), now(), false, 0, 0, '{}', v.source_key
FROM (VALUES
  ('Review care plan for Elena Garcia',    'pending', 'high',   '11-12-2026', ARRAY['Care Plan Review'], 'Elena Garcia',   'ooo-demo-abhay-1'),
  ('Review care plan for Alice Walker',    'pending', 'medium', '11-17-2026', ARRAY['Care Plan Review'], 'Alice Walker',   'ooo-demo-abhay-2'),
  ('Review care plan for Mary Thompson',   'missed',  'medium', '11-07-2026', ARRAY['Care Plan Review'], 'Mary Thompson',  'ooo-demo-abhay-3'),
  ('Med Recon review for James Rivera',    'pending', 'high',   '11-13-2026', ARRAY['Med Recon Review'], 'James Rivera',   'ooo-demo-abhay-4'),
  ('Med Recon review for Diana Welch',     'pending', 'medium', '11-19-2026', ARRAY['Med Recon Review'], 'Diana Welch',    'ooo-demo-abhay-5'),
  ('Med Recon review for Maria Lopez',     'missed',  'high',   '11-06-2026', ARRAY['Med Recon Review'], 'Maria Lopez',    'ooo-demo-abhay-6')
) AS v(name, status, priority, due, labels, patient, source_key)
JOIN LATERAL (SELECT id, full_name FROM public.profiles WHERE full_name ILIKE 'abhay%chaudhary%' LIMIT 1) pr ON true
LEFT JOIN LATERAL (SELECT id, name FROM public.patients WHERE name = v.patient LIMIT 1) pt ON true
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.source_key = v.source_key);
