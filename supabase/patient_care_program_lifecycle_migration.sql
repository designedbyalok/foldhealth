-- Care program lifecycle (patient monitoring Phase 1A).
--
-- A program can be enrolled again after its earlier enrollment ended
-- (CCM #2, TCM #3), so a patient's rows are now one per instance:
--   instance          1, 2, 3 … per (patient, code, sub-program)
-- and each instance records how it started and ended:
--   planned_end_date  MM/DD/YYYY, from the program type's max duration
--   enrolled_by       who enrolled the patient
--   closure_reason    goal_met | lost_to_follow_up | opt_out | transferred | other
--   closure_note      free text with the reason
--   closed_at / closed_by
--
-- Statuses (status column, free text) now also include Active, Paused,
-- Completed, Discontinued and Re-enrolled; Completed / Discontinued / Closed
-- count as ended (src/features/patient/data/programStatus.js).
--
-- The unique key moves from (patient_id, code, sub_program) to
-- (patient_id, code, sub_program, instance). Existing rows become instance 1.
-- The client still falls back to the old keys until this has run.
-- Idempotent. No new table, so RLS is unchanged.

ALTER TABLE public.patient_care_programs
  ADD COLUMN IF NOT EXISTS instance          integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS planned_end_date  text,
  ADD COLUMN IF NOT EXISTS enrolled_by       text,
  ADD COLUMN IF NOT EXISTS closure_reason    text,
  ADD COLUMN IF NOT EXISTS closure_note      text,
  ADD COLUMN IF NOT EXISTS closed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by         text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_care_programs_closure_reason_check') THEN
    ALTER TABLE public.patient_care_programs
      ADD CONSTRAINT patient_care_programs_closure_reason_check CHECK (
        closure_reason IS NULL OR closure_reason IN ('goal_met', 'lost_to_follow_up', 'opt_out', 'transferred', 'other')
      );
  END IF;

  -- One row per instance, not per program.
  ALTER TABLE public.patient_care_programs DROP CONSTRAINT IF EXISTS patient_care_programs_patient_id_code_sub_program_key;
  ALTER TABLE public.patient_care_programs DROP CONSTRAINT IF EXISTS patient_care_programs_patient_id_code_key;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_care_programs_instance_key') THEN
    ALTER TABLE public.patient_care_programs
      ADD CONSTRAINT patient_care_programs_instance_key UNIQUE (patient_id, code, sub_program, instance);
  END IF;
END $$;
