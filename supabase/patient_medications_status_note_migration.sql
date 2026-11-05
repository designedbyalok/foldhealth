-- Adds Status, Note, and Stop Reason to patient_medications, the
-- redesigned "Add New" form (Medication Reconciliation step) now collects
-- these alongside name/start date/sig. Stop Reason only applies when
-- status = 'Stopped' (the form only shows it then).

ALTER TABLE public.patient_medications
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS note        TEXT,
  ADD COLUMN IF NOT EXISTS stop_reason TEXT;

-- ── Verify ────────────────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--    where table_name = 'patient_medications' and column_name in ('status','note','stop_reason');
--   Expect all three.

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.patient_medications drop column if exists status;
--   alter table public.patient_medications drop column if exists note;
--   alter table public.patient_medications drop column if exists stop_reason;
