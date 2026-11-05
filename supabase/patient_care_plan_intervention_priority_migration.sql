-- Patient Care Plan: intervention priority.
--
-- WHY: The Interventions table renders a priority icon (the "P" column) and the
-- Care Plan view opens a priority menu for interventions, but patient_care_plan_
-- interventions had no `priority` column (goals and barriers do). So changing an
-- intervention's priority silently no-op'd: the menu wrote a value the row
-- mapper dropped and the table had nowhere to store. This adds the column so
-- intervention priority persists like goals and barriers.
ALTER TABLE public.patient_care_plan_interventions
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
