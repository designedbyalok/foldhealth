-- Why a care plan goal, intervention or barrier holds its status: set by the
-- "program status changes" automations (e.g. 'Program UTR' when the program
-- moves to Unable to Reach), cleared when someone picks a status by hand.
-- The app writes it only once this column exists.

ALTER TABLE public.patient_care_plan_goals         ADD COLUMN IF NOT EXISTS status_reason text;
ALTER TABLE public.patient_care_plan_interventions ADD COLUMN IF NOT EXISTS status_reason text;
ALTER TABLE public.patient_care_plan_barriers      ADD COLUMN IF NOT EXISTS status_reason text;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.patient_care_plan_goals         drop column if exists status_reason;
--   alter table public.patient_care_plan_interventions drop column if exists status_reason;
--   alter table public.patient_care_plan_barriers      drop column if exists status_reason;
