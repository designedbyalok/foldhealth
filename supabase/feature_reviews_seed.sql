-- Seed for the feature review tracker: recent features shipped to main, some
-- with sub-items, each awaiting sign-off. Fixed ids so re-running inserts
-- nothing new. Requires supabase/feature_reviews_migration.sql.

INSERT INTO public.feature_reviews (id, parent_id, title, description, area, link, created_by, created_at)
VALUES
  ('6f1c2a10-0001-4c3e-9a51-000000000001', NULL,
   'SMS attribution for shared phone numbers',
   'When several members share one phone number, staff pick which member an SMS is logged for. The member''s CRM Activity lists the SMS logged for them.',
   'Comms', '#/messages', 'Alok Kumar', '2026-10-26 10:00:00+00'),

  ('6f1c2a10-0001-4c3e-9a51-000000000002', NULL,
   'Pharmacy worklist',
   'Gap status model, filters, rules and reports on the Pharmacy worklist.',
   'Population · Pharmacy', '#/population/pharmacy', 'Alok Kumar', '2026-10-24 10:00:00+00'),
  ('6f1c2a10-0001-4c3e-9a51-000000000021', '6f1c2a10-0001-4c3e-9a51-000000000002',
   'Gap status model',
   'Open, In Progress, Pending Claim, Closed, Met for Year, Failed for Year and Excluded, with one sub-status per gap.',
   'Population · Pharmacy', '#/population/pharmacy', 'Alok Kumar', '2026-10-24 10:01:00+00'),
  ('6f1c2a10-0001-4c3e-9a51-000000000022', '6f1c2a10-0001-4c3e-9a51-000000000002',
   'Filters and saved views',
   NULL,
   'Population · Pharmacy', '#/population/pharmacy', 'Alok Kumar', '2026-10-24 10:02:00+00'),

  ('6f1c2a10-0001-4c3e-9a51-000000000003', NULL,
   'Overview widget redesign',
   'Attention-first widgets on the patient Overview.',
   'Patient profile · Overview', '#/population/patient/11089/overview', 'Alok Kumar', '2026-10-23 10:00:00+00'),
  ('6f1c2a10-0001-4c3e-9a51-000000000031', '6f1c2a10-0001-4c3e-9a51-000000000003',
   'Recap with Unity summaries',
   'Saved Unity summaries with a Refresh, and "since last visit".',
   'Patient profile · Overview', '#/population/patient/11089/overview', 'Alok Kumar', '2026-10-23 10:01:00+00'),
  ('6f1c2a10-0001-4c3e-9a51-000000000032', '6f1c2a10-0001-4c3e-9a51-000000000003',
   'Reminders and missed appointments',
   NULL,
   'Patient profile · Overview', '#/population/patient/11089/overview', 'Alok Kumar', '2026-10-23 10:02:00+00'),

  ('6f1c2a10-0001-4c3e-9a51-000000000004', NULL,
   'Access Control roles',
   'Role-based access to nav sections and programs, plus the new account security emails.',
   'Settings · Account', '#/settings/account/access-control', 'Alok Kumar', '2026-10-20 10:00:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feature_review_signoffs (id, feature_id, reviewer_email, reviewer_name, assigned_by)
VALUES
  ('7a2d3b20-0001-4d4f-8b62-000000000001', '6f1c2a10-0001-4c3e-9a51-000000000001', 'alokk@fold.health', 'Alok Kumar', 'Alok Kumar'),
  ('7a2d3b20-0001-4d4f-8b62-000000000002', '6f1c2a10-0001-4c3e-9a51-000000000001', 'devanshis@fold.health', 'Devanshi Sharma', 'Alok Kumar'),
  ('7a2d3b20-0001-4d4f-8b62-000000000021', '6f1c2a10-0001-4c3e-9a51-000000000021', 'ketanp@fold.health', 'Ketan Patni', 'Alok Kumar'),
  ('7a2d3b20-0001-4d4f-8b62-000000000022', '6f1c2a10-0001-4c3e-9a51-000000000022', 'ketanp@fold.health', 'Ketan Patni', 'Alok Kumar'),
  ('7a2d3b20-0001-4d4f-8b62-000000000031', '6f1c2a10-0001-4c3e-9a51-000000000031', 'alokk@fold.health', 'Alok Kumar', 'Alok Kumar'),
  ('7a2d3b20-0001-4d4f-8b62-000000000032', '6f1c2a10-0001-4c3e-9a51-000000000032', 'devanshis@fold.health', 'Devanshi Sharma', 'Alok Kumar'),
  ('7a2d3b20-0001-4d4f-8b62-000000000004', '6f1c2a10-0001-4c3e-9a51-000000000004', 'ketanp@fold.health', 'Ketan Patni', 'Alok Kumar')
ON CONFLICT (id) DO NOTHING;
