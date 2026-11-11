-- TOC IP discharge workflow (care management redesign prototype): what the
-- TOC IP worklist shows per discharged patient. Columns on `patients`, the
-- table the TOC rows already live in (patientMapper.js maps them):
--
--   discharge_time      text   "6:40 AM", alongside discharge_date (MM/DD/YYYY)
--   contact_met_at      text   MM/DD/YYYY the interactive contact was made;
--                              until then the 2-Day Contact is due 2 business
--                              days after discharge (computed in the app)
--   relay_status        text   'attempts' | 'live' | 'completed' | null
--   relay_by            text   who: the agent (e.g. Erica) or the care manager
--   relay_note          text   one line on what happened
--   relay_attempts      int    agent call attempts so far
--   visit_window_days   int    7 (high complexity) or 14
--   visit_booked_at     text   MM/DD/YYYY of the booked face-to-face visit
--   med_rec_status      text   'Not started' | 'Pending' | 'Done'
--   med_rec_at          text   MM/DD/YYYY reconciliation was done
--
-- Additive and idempotent. Sample data: supabase/toc_discharge_workflow_seed.sql.

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS discharge_time text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS contact_met_at text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS relay_status text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS relay_by text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS relay_note text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS relay_attempts integer;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS visit_window_days integer;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS visit_booked_at text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS med_rec_status text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS med_rec_at text;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.patients drop column if exists discharge_time, drop column if exists contact_met_at,
--     drop column if exists relay_status, drop column if exists relay_by, drop column if exists relay_note,
--     drop column if exists relay_attempts, drop column if exists visit_window_days,
--     drop column if exists visit_booked_at, drop column if exists med_rec_status, drop column if exists med_rec_at;
