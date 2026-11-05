-- Seed 15 additional HEDIS members into public.hedis_members so the
-- Population > HEDIS worklist has coverage for the two DSF workflows:
--   • 10 DSF-A-only rows (`ap-dsfa-01` … `ap-dsfa-10`): reviewers
--     working the Depression Screening PHQ-2 without a paired
--     Follow-Up gap yet.
--   • 5 DSF-B-only rows (`ap-dsfb-01` … `ap-dsfb-05`): reviewers
--     who completed the PHQ-2 virtually and skipped creating the
--     Depression Screening care program, leaving only the follow-up
--     (PHQ-9) gap on the worklist. These are the rows the "Due in
--     18d" chip surfaces on.
--
-- WHY
-- src/features/hedis-worklist/data/mock.js is the source of truth for
-- scripts/seed.js, but as soon as the hedis_members table has ANY
-- rows the Supabase fetch wins over the client-side mock fallback,
-- new mock additions never surface unless a seed writes them into
-- Supabase too. This migration mirrors the mock additions verbatim
-- so both paths agree.
--
-- SHAPE (see mock.js for full descriptors)
--   ap-dsfa-01 Rita Naidoo         DSF-A only, unassigned
--   ap-dsfa-02 Elena Sanchez       DSF-A only, unassigned
--   ap-dsfa-03 Marcus Trent        DSF-A only, Isabeth Partida Fra
--   ap-dsfa-04 Priya Kapoor        DSF-A only, unassigned
--   ap-dsfa-05 Henry Chen          DSF-A only, Marcus Chen
--   ap-dsfa-06 Diana Okafor        DSF-A only, unassigned
--   ap-dsfa-07 Rafael Aguilar      DSF-A only, unassigned
--   ap-dsfa-08 Sophia Nakamura     DSF-A only, Isabeth Partida Fra
--   ap-dsfa-09 Jamal Brooks        DSF-A only, unassigned
--   ap-dsfa-10 Carla Vargas        DSF-A only, Isabeth Partida Fra
--   ap-dsfb-01 Linda Becker        DSF-B only, Isabeth Partida Fra
--   ap-dsfb-02 Gustavo Ortiz       DSF-B only, Marcus Chen
--   ap-dsfb-03 Aisha Williams      DSF-B only, unassigned
--   ap-dsfb-04 Paul Tanaka         DSF-B only, Isabeth Partida Fra
--   ap-dsfb-05 Nadia Mehta         DSF-B only, Marcus Chen
--
-- SAFETY
-- Each row is inserted with a WHERE NOT EXISTS guard on the text id
-- so the migration is idempotent and safe to re-run, hand edits in
-- the database survive re-runs.

-- ── DSF-A-only (10 members) ────────────────────────────────────────

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-01', 'RN', 'Rita Naidoo', 'F', '63y', '10201', 'en',
  '[{"code":"DSF-A","status":"Open","startDate":"05/20/2026","source":"astrana"}]'::jsonb,
  NULL, NULL, '05/20/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 201-0201', '02/14/1963', 'Astrana', 'HP-001', '10001', 'New York', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-01');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-02', 'ES', 'Elena Sanchez', 'F', '58y', '10202', 'es',
  '[{"code":"DSF-A","status":"Open","startDate":"05/19/2026","source":"astrana"}]'::jsonb,
  NULL, NULL, '05/19/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 202-0202', '11/03/1968', 'Astrana', 'HP-002', '10002', 'New York', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-02');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-03', 'MT', 'Marcus Trent', 'M', '71y', '10203', 'en',
  '[{"code":"DSF-A","status":"Open","startDate":"05/18/2026","source":"astrana"}]'::jsonb,
  'Isabeth Partida Fra', 'IP', '05/18/2026', 1, 0, '3_Moderate', NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 203-0203', '07/22/1955', 'Astrana', 'HP-001', '10003', 'New York', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-03');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-04', 'PK', 'Priya Kapoor', 'F', '54y', '10204', 'hi',
  '[{"code":"DSF-A","status":"Open","startDate":"05/17/2026","source":"astrana"}]'::jsonb,
  NULL, NULL, '05/17/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 204-0204', '01/12/1972', 'Astrana', 'HP-002', '10004', 'New York', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-04');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-05', 'HC', 'Henry Chen', 'M', '67y', '10205', 'zh',
  '[{"code":"DSF-A","status":"Open","startDate":"05/17/2026","source":"astrana"}]'::jsonb,
  'Marcus Chen', 'MC', '05/17/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 205-0205', '04/30/1959', 'Astrana', 'HP-001', '10005', 'New York', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-05');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-06', 'DO', 'Diana Okafor', 'F', '48y', '10206', 'en',
  '[{"code":"DSF-A","status":"Open","startDate":"05/16/2026","source":"astrana"}]'::jsonb,
  NULL, NULL, '05/16/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 206-0206', '09/09/1978', 'Astrana', 'HP-002', '10006', 'Newark', 'NJ'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-06');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-07', 'RA', 'Rafael Aguilar', 'M', '61y', '10207', 'es',
  '[{"code":"DSF-A","status":"Open","startDate":"05/15/2026","source":"astrana"}]'::jsonb,
  NULL, NULL, '05/15/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 207-0207', '03/18/1965', 'Astrana', 'HP-001', '10007', 'Newark', 'NJ'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-07');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-08', 'SN', 'Sophia Nakamura', 'F', '55y', '10208', 'en',
  '[{"code":"DSF-A","status":"Open","startDate":"05/14/2026","source":"astrana"}]'::jsonb,
  'Isabeth Partida Fra', 'IP', '05/14/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 208-0208', '12/05/1971', 'Astrana', 'HP-002', '10008', 'Jersey City', 'NJ'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-08');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-09', 'JB', 'Jamal Brooks', 'M', '52y', '10209', 'en',
  '[{"code":"DSF-A","status":"Open","startDate":"05/13/2026","source":"astrana"}]'::jsonb,
  NULL, NULL, '05/13/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 209-0209', '06/24/1974', 'Astrana', 'HP-001', '10009', 'Jersey City', 'NJ'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-09');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfa-10', 'CV', 'Carla Vargas', 'F', '69y', '10210', 'es',
  '[{"code":"DSF-A","status":"Open","startDate":"05/12/2026","source":"astrana"}]'::jsonb,
  'Isabeth Partida Fra', 'IP', '05/12/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 210-0210', '08/17/1957', 'Astrana', 'HP-002', '10010', 'Newark', 'NJ'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfa-10');

-- ── DSF-B-only (5 members) ─────────────────────────────────────────
-- Standalone DSF-B rows come in from Astrana when the PHQ-2 (DSF-A)
-- was completed outside Fold. `source: astrana` reflects the true
-- origin, and `dueDateISO` anchors the 30-day sign-off window to the
-- gap's ingestion date (startDate + 30d) since we never observed a
-- PHQ-2 savedAt in Fold. Worklist row derives Due in Nd / Overdue by
-- Nd from that dueDateISO.

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfb-01', 'LB', 'Linda Becker', 'F', '64y', '10301', 'en',
  '[{"code":"DSF-B","status":"Open","startDate":"05/20/2026","source":"astrana","dueDateISO":"2026-06-19T00:00:00.000Z"}]'::jsonb,
  'Isabeth Partida Fra', 'IP', '05/20/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 301-0301', '10/12/1962', 'Astrana', 'HP-001', '10011', 'New York', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfb-01');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfb-02', 'GO', 'Gustavo Ortiz', 'M', '59y', '10302', 'es',
  '[{"code":"DSF-B","status":"Open","startDate":"05/19/2026","source":"astrana","dueDateISO":"2026-06-18T00:00:00.000Z"}]'::jsonb,
  'Marcus Chen', 'MC', '05/19/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 302-0302', '05/07/1967', 'Astrana', 'HP-002', '10012', 'Bronx', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfb-02');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfb-03', 'AW', 'Aisha Williams', 'F', '46y', '10303', 'en',
  '[{"code":"DSF-B","status":"Open","startDate":"05/18/2026","source":"astrana","dueDateISO":"2026-06-17T00:00:00.000Z"}]'::jsonb,
  NULL, NULL, '05/18/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 303-0303', '02/28/1980', 'Astrana', 'HP-001', '10013', 'Brooklyn', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfb-03');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfb-04', 'PT', 'Paul Tanaka', 'M', '73y', '10304', 'en',
  '[{"code":"DSF-B","status":"Open","startDate":"05/17/2026","source":"astrana","dueDateISO":"2026-06-16T00:00:00.000Z"}]'::jsonb,
  'Isabeth Partida Fra', 'IP', '05/17/2026', 1, 0, '3_Moderate', NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 304-0304', '11/16/1952', 'Astrana', 'HP-002', '10014', 'Queens', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfb-04');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'ap-dsfb-05', 'NM', 'Nadia Mehta', 'F', '50y', '10305', 'hi',
  '[{"code":"DSF-B","status":"Open","startDate":"05/15/2026","source":"astrana","dueDateISO":"2026-06-14T00:00:00.000Z"}]'::jsonb,
  'Marcus Chen', 'MC', '05/15/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 305-0305', '07/09/1976', 'Astrana', 'HP-001', '10015', 'Queens', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'ap-dsfb-05');
