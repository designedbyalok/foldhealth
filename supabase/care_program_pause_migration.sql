-- Care program Pause: why a program is Paused, from when, until when, and
-- whether it resumes on its own. Mirrors care_plan_pause_migration.sql.
--
-- Setting a program to Paused asks for these (PauseCarePlanDialog) and pauses
-- the program's care plan with the same details. Moving the program off
-- Paused clears them and resumes the plan; with auto_resume set the program
-- returns to Active when the patient's programs are next loaded on or after
-- resume_on. The status column stays free text ('Paused').
--
-- Additive and idempotent. No new table, so RLS is unchanged.

ALTER TABLE public.patient_care_programs
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS pause_note   text,
  ADD COLUMN IF NOT EXISTS paused_on    date,
  ADD COLUMN IF NOT EXISTS resume_on    date,
  ADD COLUMN IF NOT EXISTS auto_resume  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_by    text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_care_programs_pause_reason_check') THEN
    ALTER TABLE public.patient_care_programs
      ADD CONSTRAINT patient_care_programs_pause_reason_check
      CHECK (pause_reason IS NULL OR pause_reason IN ('hospitalized', 'traveling', 'patient_request', 'other'));
  END IF;
  -- A planned resume can't come before the pause, and auto-resume needs one.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_care_programs_pause_fields_check') THEN
    ALTER TABLE public.patient_care_programs
      ADD CONSTRAINT patient_care_programs_pause_fields_check CHECK (
        (resume_on IS NULL OR paused_on IS NULL OR resume_on >= paused_on)
        AND (NOT auto_resume OR resume_on IS NOT NULL)
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.patient_care_programs
--   DROP CONSTRAINT IF EXISTS patient_care_programs_pause_fields_check,
--   DROP CONSTRAINT IF EXISTS patient_care_programs_pause_reason_check,
--   DROP COLUMN IF EXISTS pause_reason, DROP COLUMN IF EXISTS pause_note,
--   DROP COLUMN IF EXISTS paused_on, DROP COLUMN IF EXISTS resume_on,
--   DROP COLUMN IF EXISTS auto_resume, DROP COLUMN IF EXISTS paused_by;
