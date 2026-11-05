-- Seed 15 additional HEDIS members (hd16–hd30) into public.hedis_members so
-- the Population > HEDIS worklist has richer volume for demo/QA runs.
--
-- WHY
-- The client falls back to the src/features/hedis-worklist/data/mock.js
-- constant when the table is empty, but as soon as the table has ANY rows
-- the Supabase fetch wins: so the mock additions never surface. This seed
-- mirrors the mock additions verbatim so both paths agree.
--
-- SHAPE
-- Four members carry 9+ open gaps to exercise the consolidated-note flow:
--   hd16 Angela Rivera: 9 gaps  (female / older adult)
--   hd22 David Nakamura: 11 gaps (male / older adult)
--   hd23 Grace Bennett: 9 gaps  (female / older adult)
--   hd28 Frank O'Neil: 12 gaps (male / older adult)
-- The remaining members carry 2–5 gaps across pediatric, prenatal,
-- adolescent, and adult ranges, with gender-appropriate codes
-- (BCS/CCS/OMW/CHL/PPC* female-only, W30A/W30B/DEV/LSC pediatric, etc.).
--
-- SAFETY
-- Each row is inserted with a WHERE NOT EXISTS guard on the text id
-- so the migration is idempotent and safe to re-run, hand-edits in the
-- database survive re-runs.

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd16', 'AR', 'Angela Rivera', 'F', '68y 2m', '#HPM345678902', 'es',
  '[{"code":"BCS","status":"Open","startDate":"04/24/2026"},{"code":"CBP","status":"Open","startDate":"04/24/2026"},{"code":"COL","status":"Open","startDate":"04/24/2026"},{"code":"KED","status":"Open","startDate":"04/24/2026"},{"code":"COA-FS","status":"Open","startDate":"04/24/2026"},{"code":"COA-M","status":"Open","startDate":"04/24/2026"},{"code":"OMW","status":"Open","startDate":"04/24/2026"},{"code":"BPD","status":"Open","startDate":"04/24/2026"},{"code":"POLYACH","status":"Open","startDate":"04/24/2026"}]'::jsonb,
  'Marcus Chen', 'MC', '04/24/2026', 2, 1, '1_High', 3, '["success","pending","pending"]'::jsonb, '04/25/2026', 'Active', '(555) 444-5555', '06/12/1958', 'IPA-West', 'HP-001', '90032', 'Los Angeles', 'CA'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd16');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd17', 'MR', 'Marcus Reid', 'M', '62y 5m', '#HPM456789013', 'en',
  '[{"code":"CBP","status":"Open","startDate":"04/22/2026"},{"code":"KED","status":"Open","startDate":"04/22/2026"},{"code":"EED","status":"Open","startDate":"04/22/2026"},{"code":"SUPD","status":"Open","startDate":"04/22/2026"},{"code":"GSD3","status":"Open","startDate":"04/22/2026"}]'::jsonb,
  NULL, NULL, '04/22/2026', 1, 0, '2_Mod-High', 1, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 555-6666', '03/08/1964', 'IPA-North', 'HP-002', '77003', 'Houston', 'TX'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd17');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd18', 'PS', 'Priya Shah', 'F', '45y 9m', '#HPM567890124', 'hi',
  '[{"code":"BCS","status":"Open","startDate":"04/20/2026"},{"code":"CCS","status":"Open","startDate":"04/20/2026"},{"code":"CHL","status":"Open","startDate":"04/20/2026"}]'::jsonb,
  'Isabeth Partida Fra', 'IP', '04/20/2026', 0, 0, '3_Moderate', NULL, '["success","pending","pending"]'::jsonb, '04/21/2026', 'Active', '(555) 666-7777', '11/03/1980', 'IPA-East', 'HP-003', '10003', 'New York', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd18');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd19', 'EW', 'Ethan Wilson', 'M', '2y 5m', '#HPM678901235', 'en',
  '[{"code":"W30A","status":"Open","startDate":"04/18/2026"},{"code":"W30B","status":"Open","startDate":"04/18/2026"},{"code":"DEV","status":"Open","startDate":"04/18/2026"},{"code":"LSC","status":"Open","startDate":"04/18/2026"},{"code":"CISCMG10","status":"Open","startDate":"04/18/2026"}]'::jsonb,
  NULL, NULL, '04/18/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 777-8888', '11/04/2023', 'IPA-West', 'HP-001', '94105', 'San Francisco', 'CA'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd19');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd20', 'ZK', 'Zoe Kim', 'F', '2y 0m', '#HPM789012346', 'ko',
  '[{"code":"W30A","status":"Open","startDate":"04/16/2026"},{"code":"DEV","status":"Open","startDate":"04/16/2026"},{"code":"LSC","status":"Open","startDate":"04/16/2026"}]'::jsonb,
  'Sarah Lee', 'SL', '04/16/2026', 0, 0, NULL, 1, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 888-9999', '04/12/2024', 'IPA-North', 'HP-002', '90211', 'Los Angeles', 'CA'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd20');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd21', 'SA', 'Sophia Alvarez', 'F', '15y 3m', '#HPM890123457', 'es',
  '[{"code":"WCV","status":"Open","startDate":"04/14/2026"},{"code":"IMACMB2","status":"Open","startDate":"04/14/2026"},{"code":"CHL","status":"Open","startDate":"04/14/2026"}]'::jsonb,
  NULL, NULL, '04/14/2026', 0, 0, NULL, NULL, '["failed","pending","pending"]'::jsonb, '04/15/2026', 'Active', '(555) 999-0000', '01/22/2011', 'IPA-East', 'HP-005', '60602', 'Chicago', 'IL'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd21');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd22', 'DN', 'David Nakamura', 'M', '72y 6m', '#HPM901234568', 'ja',
  '[{"code":"COL","status":"Open","startDate":"04/12/2026"},{"code":"KED","status":"Open","startDate":"04/12/2026"},{"code":"EED","status":"Open","startDate":"04/12/2026"},{"code":"COA-FS","status":"Open","startDate":"04/12/2026"},{"code":"COA-M","status":"Open","startDate":"04/12/2026"},{"code":"BPD","status":"Open","startDate":"04/12/2026"},{"code":"POLYACH","status":"Open","startDate":"04/12/2026"},{"code":"SUPD","status":"Open","startDate":"04/12/2026"},{"code":"GSD3","status":"Open","startDate":"04/12/2026"},{"code":"MRP","status":"Open","startDate":"04/12/2026"},{"code":"TRCEA","status":"Open","startDate":"04/12/2026"},{"code":"TRCMA","status":"Open","startDate":"04/12/2026"}]'::jsonb,
  'Marcus Chen', 'MC', '04/12/2026', 3, 2, '1_High', 4, '["success","success","pending"]'::jsonb, '04/13/2026', 'Active', '(555) 000-1111', '10/09/1954', 'IPA-West', 'HP-001', '94106', 'San Francisco', 'CA'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd22');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd23', 'GB', 'Grace Bennett', 'F', '65y 8m', '#HPM012345679', 'en',
  '[{"code":"BCS","status":"Open","startDate":"04/10/2026"},{"code":"CCS","status":"Open","startDate":"04/10/2026"},{"code":"COL","status":"Open","startDate":"04/10/2026"},{"code":"KED","status":"Open","startDate":"04/10/2026"},{"code":"COA-FS","status":"Open","startDate":"04/10/2026"},{"code":"COA-M","status":"Open","startDate":"04/10/2026"},{"code":"OMW","status":"Open","startDate":"04/10/2026"},{"code":"BPD","status":"Open","startDate":"04/10/2026"},{"code":"MRP","status":"Open","startDate":"04/10/2026"}]'::jsonb,
  'Isabeth Partida Fra', 'IP', '04/10/2026', 2, 1, '1_High', 2, '["success","success","success"]'::jsonb, '04/11/2026', 'Active', '(555) 121-2323', '12/18/1960', 'IPA-South', 'HP-004', '30303', 'Atlanta', 'GA'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd23');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd24', 'JF', 'Jamal Foster', 'M', '35y 4m', '#HPM123456781', 'en',
  '[{"code":"FMC","status":"Open","startDate":"04/08/2026"},{"code":"SUPD","status":"Open","startDate":"04/08/2026"},{"code":"GSD3","status":"Open","startDate":"04/08/2026"},{"code":"EED","status":"Open","startDate":"04/08/2026"}]'::jsonb,
  NULL, NULL, '04/08/2026', 0, 0, '2_Mod-High', 1, '["failed","pending","pending"]'::jsonb, '04/09/2026', 'Active', '(555) 232-3434', '04/03/1991', 'IPA-East', 'HP-005', '60603', 'Chicago', 'IL'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd24');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd25', 'LM', 'Lucia Moreno', 'F', '28y 7m', '#HPM234567892', 'es',
  '[{"code":"PPC1A","status":"Open","startDate":"04/06/2026"},{"code":"PPC2A","status":"Open","startDate":"04/06/2026"},{"code":"CCS","status":"Open","startDate":"04/06/2026"},{"code":"CHL","status":"Open","startDate":"04/06/2026"}]'::jsonb,
  'Sarah Lee', 'SL', '04/06/2026', 0, 0, '3_Moderate', NULL, '["success","pending","pending"]'::jsonb, '04/07/2026', 'Active', '(555) 343-4545', '01/16/1998', 'IPA-West', 'HP-001', '90212', 'Los Angeles', 'CA'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd25');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd26', 'HP', 'Henry Park', 'M', '5y 3m', '#HPM345678903', 'ko',
  '[{"code":"WCV","status":"Open","startDate":"04/04/2026"},{"code":"IMACMB2","status":"Open","startDate":"04/04/2026"},{"code":"LSC","status":"Open","startDate":"04/04/2026"}]'::jsonb,
  NULL, NULL, '04/04/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 454-5656', '01/28/2021', 'IPA-North', 'HP-002', '10020', 'New York', 'NY'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd26');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd27', 'CB', 'Charlotte Bell', 'F', '12y 10m', '#HPM456789014', 'en',
  '[{"code":"WCV","status":"Open","startDate":"04/02/2026"},{"code":"IMACMB2","status":"Open","startDate":"04/02/2026"}]'::jsonb,
  'Marcus Chen', 'MC', '04/02/2026', 0, 0, NULL, NULL, '["success","pending","pending"]'::jsonb, '04/03/2026', 'Active', '(555) 565-6767', '06/17/2013', 'IPA-East', 'HP-005', '60604', 'Chicago', 'IL'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd27');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd28', 'FO', 'Frank O''Neil', 'M', '70y 4m', '#HPM567890125', 'en',
  '[{"code":"COL","status":"Open","startDate":"03/31/2026"},{"code":"KED","status":"Open","startDate":"03/31/2026"},{"code":"COA-FS","status":"Open","startDate":"03/31/2026"},{"code":"COA-M","status":"Open","startDate":"03/31/2026"},{"code":"COB","status":"Open","startDate":"03/31/2026"},{"code":"BPD","status":"Open","startDate":"03/31/2026"},{"code":"POLYACH","status":"Open","startDate":"03/31/2026"},{"code":"CBP","status":"Open","startDate":"03/31/2026"},{"code":"SUPD","status":"Open","startDate":"03/31/2026"},{"code":"MRP","status":"Open","startDate":"03/31/2026"},{"code":"TRCEA","status":"Open","startDate":"03/31/2026"},{"code":"TRCMA","status":"Open","startDate":"03/31/2026"}]'::jsonb,
  'Isabeth Partida Fra', 'IP', '03/31/2026', 4, 3, '1_High', 5, '["success","failed","pending"]'::jsonb, '04/01/2026', 'Active', '(555) 676-7878', '05/22/1956', 'IPA-South', 'HP-004', '30304', 'Atlanta', 'GA'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd28');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd29', 'NR', 'Nadia Rahman', 'F', '42y 2m', '#HPM678901236', 'bn',
  '[{"code":"BCS","status":"Open","startDate":"03/29/2026"},{"code":"CCS","status":"Open","startDate":"03/29/2026"},{"code":"CBP","status":"Open","startDate":"03/29/2026"},{"code":"KED","status":"Open","startDate":"03/29/2026"}]'::jsonb,
  NULL, NULL, '03/29/2026', 0, 0, '2_Mod-High', NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 787-8989', '06/25/1984', 'IPA-West', 'HP-001', '90213', 'Los Angeles', 'CA'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd29');

INSERT INTO public.hedis_members (id, initials, name, gender, age, member_id, language, gaps, assignee, assignee_initials, start_date, adv_illness, frailty, risk_level, tasks, outreach_dots, outreach_date, member_status, phone, dob, ipa, hp_code, zip, city, state)
SELECT 'hd30', 'OC', 'Oliver Chen', 'M', '8y 1m', '#HPM789012347', 'zh',
  '[{"code":"WCV","status":"Open","startDate":"03/27/2026"},{"code":"LSC","status":"Open","startDate":"03/27/2026"},{"code":"IMACMB2","status":"Open","startDate":"03/27/2026"}]'::jsonb,
  'Sarah Lee', 'SL', '03/27/2026', 0, 0, NULL, NULL, '["pending","pending","pending"]'::jsonb, NULL, 'Active', '(555) 898-9090', '07/15/2018', 'IPA-North', 'HP-002', '77004', 'Houston', 'TX'
WHERE NOT EXISTS (SELECT 1 FROM public.hedis_members WHERE id = 'hd30');
