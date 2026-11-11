-- Out of Office records: who covers while the user is away, for the records
-- table's "Covered By" column and the OOO drawer's covering section.
-- One entry per location: [{ "userId", "userName", "location" }]. A provider
-- covering several locations appears once per location.
--
-- Run after supabase/ooo_records_migration.sql. Safe to re-run.

ALTER TABLE public.ooo_records ADD COLUMN IF NOT EXISTS coverage jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Demo coverage so the column has something to show. Only fills records
-- that have none yet, and only for users whose profiles exist.
--   Abhay Chaudhary, current and upcoming: Abhijit Gupta (Downtown Clinic,
--     SEB Office) and Navin Jethwani (Riverside Clinic).
--   Abhijit Gupta: Abhay Chaudhary (Downtown Clinic).
WITH p AS (
  SELECT id, trim(full_name) AS name FROM public.profiles
  WHERE full_name ILIKE 'abhijit%gupta%' OR full_name ILIKE 'navin%jethwani%' OR full_name ILIKE 'abhay%chaudhary%'
),
abhijit AS (SELECT * FROM p WHERE name ILIKE 'abhijit%' LIMIT 1),
navin   AS (SELECT * FROM p WHERE name ILIKE 'navin%' LIMIT 1),
abhay   AS (SELECT * FROM p WHERE name ILIKE 'abhay%' LIMIT 1)
UPDATE public.ooo_records r
SET coverage = (
  SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('userId', abhijit.id, 'userName', abhijit.name, 'location', 'Downtown Clinic') AS e FROM abhijit
    UNION ALL SELECT jsonb_build_object('userId', abhijit.id, 'userName', abhijit.name, 'location', 'SEB Office') FROM abhijit
    UNION ALL SELECT jsonb_build_object('userId', navin.id, 'userName', navin.name, 'location', 'Riverside Clinic') FROM navin
  ) x
)
WHERE r.user_name ILIKE 'abhay%chaudhary%'
  AND r.end_at > now()
  AND r.coverage = '[]'::jsonb;

WITH abhay AS (
  SELECT id, trim(full_name) AS name FROM public.profiles WHERE full_name ILIKE 'abhay%chaudhary%' LIMIT 1
)
UPDATE public.ooo_records r
SET coverage = jsonb_build_array(jsonb_build_object('userId', abhay.id, 'userName', abhay.name, 'location', 'Downtown Clinic'))
FROM abhay
WHERE r.user_name ILIKE 'abhijit%gupta%'
  AND r.coverage = '[]'::jsonb;

-- Demo: two people out of office inside Abhay's current dates, so the
-- Covering Provider picker shows its Not Available group. Both work at one of
-- Abhay's locations (Mary Health), so they'd otherwise be Suggested.
INSERT INTO public.ooo_records (id, user_id, user_name, user_email, user_role, start_at, end_at, reason, auto_reply, auto_reply_message, created_by, created_at, updated_at, updated_by)
SELECT v.id, p.id, trim(p.full_name), p.email, 'Staff', v.start_at, v.end_at, v.reason, false, '', 'Devanshi Sharma', now(), now(), 'Devanshi Sharma'
FROM (VALUES
  ('ooo-demo-cover-ajay', 'ajay%lakshman%', timestamptz '2026-11-10 00:00:00+05:30', timestamptz '2026-11-13 00:00:00+05:30', 'Annual Leave'),
  ('ooo-demo-cover-amar', 'amar%jagtap%',   timestamptz '2026-11-16 00:00:00+05:30', timestamptz '2026-11-21 00:00:00+05:30', 'Personal')
) AS v(id, name_like, start_at, end_at, reason)
JOIN LATERAL (
  SELECT id, full_name, email FROM public.profiles WHERE full_name ILIKE v.name_like LIMIT 1
) p ON true
ON CONFLICT (id) DO NOTHING;
