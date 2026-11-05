-- Where a care plan goal, intervention or barrier was before its program's
-- Unable to Reach or Paused automation moved it: { from, reason, to }.
-- When the program comes back (e.g. to Active), items still at `to` return
-- to `from` with `reason`, and the column is cleared. Completed and Closed
-- never set it. The app reads and writes it only once this column exists.
--
-- Additive and idempotent.

ALTER TABLE public.patient_care_plan_goals         ADD COLUMN IF NOT EXISTS status_hold jsonb;
ALTER TABLE public.patient_care_plan_interventions ADD COLUMN IF NOT EXISTS status_hold jsonb;
ALTER TABLE public.patient_care_plan_barriers      ADD COLUMN IF NOT EXISTS status_hold jsonb;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.patient_care_plan_goals         drop column if exists status_hold;
--   alter table public.patient_care_plan_interventions drop column if exists status_hold;
--   alter table public.patient_care_plan_barriers      drop column if exists status_hold;
