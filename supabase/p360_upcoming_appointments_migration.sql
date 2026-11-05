-- ============================================================
-- P360 banner: persist "Upcoming Appointments" per patient.
-- The expanded banner reads p.upcoming_appointments; until now it
-- only existed in FALLBACK_P360, so every patient with a real
-- p360_profiles row rendered an empty Appointments column.
-- ============================================================
--
-- Deliberately NO DEFAULT: existing rows must stay NULL so the
-- seed's `coalesce(existing, excluded)` upsert can fill them.
-- Shape: [{ type, date, time, program, provider }]

ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS upcoming_appointments JSONB;
