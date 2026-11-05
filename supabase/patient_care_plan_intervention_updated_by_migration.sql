-- Patient Care Plan: Intervention Details drawer (Figma SNP-Story "Intervention Details").
--
-- WHY: The intervention preview drawer shows a "Last Updated … by <name>" meta
-- line (same pattern as Goal Details). Interventions had updated_at but no
-- updated_by column to store the staff name.
--
-- WHAT:
--   patient_care_plan_interventions gains `updated_by` (staff name shown in
--   the meta line).
--
-- RLS: no change, same posture as the rest of patient_care_plan_* tables.

ALTER TABLE public.patient_care_plan_interventions
  ADD COLUMN IF NOT EXISTS updated_by text;
