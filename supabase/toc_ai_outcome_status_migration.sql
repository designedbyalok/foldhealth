-- Explicit AI Outcome label per patient, decoupled from call-queue status so
-- demo rows can show Completed / Needs Review / Aborted without appearing Queued.

BEGIN;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS ai_outcome_status TEXT
    CHECK (ai_outcome_status IN ('Queued', 'Completed', 'Needs Review', 'Aborted'));

-- Rows beyond the first 5 demo blanks, mixed terminal outcomes with sample invoke times.
UPDATE public.patients SET
  ai_outcome_status = 'Needs Review',
  ai_outcome_invoked_at = '2026-08-16T09:12:00Z',
  assessment_status = 'In Progress',
  outreach_status = 'Attempted',
  status = 'review',
  on_call = false
WHERE id = 'p9';

UPDATE public.patients SET
  ai_outcome_status = 'Needs Review',
  ai_outcome_invoked_at = '2026-08-16T10:45:00Z',
  assessment_status = 'In Progress',
  outreach_status = 'Attempted',
  status = 'failed',
  on_call = false
WHERE id = 'p12';

UPDATE public.patients SET
  ai_outcome_status = 'Completed',
  ai_outcome_invoked_at = '2026-08-15T16:30:00Z',
  assessment_status = 'Completed',
  outreach_status = 'Completed',
  status = 'completed',
  on_call = false
WHERE id = 'p14';

UPDATE public.patients SET
  ai_outcome_status = 'Needs Review',
  ai_outcome_invoked_at = '2026-08-17T08:05:00Z',
  assessment_status = 'Overdue',
  outreach_status = 'Attempted',
  status = 'failed',
  on_call = false
WHERE id = 'p15';

UPDATE public.patients SET
  ai_outcome_status = 'Aborted',
  ai_outcome_invoked_at = '2026-08-17T11:20:00Z',
  assessment_status = 'Not Started',
  outreach_status = 'Not Started',
  status = 'scheduled',
  on_call = false
WHERE id = 'p17';

UPDATE public.patients SET
  ai_outcome_status = 'Completed',
  ai_outcome_invoked_at = '2026-08-14T13:55:00Z',
  assessment_status = 'Completed',
  outreach_status = 'Completed',
  status = 'completed',
  on_call = false
WHERE id = 'p20';

UPDATE public.patients SET
  ai_outcome_status = 'Needs Review',
  ai_outcome_invoked_at = '2026-08-17T15:40:00Z',
  assessment_status = 'In Progress',
  outreach_status = 'Attempted',
  status = 'failed',
  on_call = false
WHERE id = 'p21';

UPDATE public.patients SET
  ai_outcome_status = 'Aborted',
  ai_outcome_invoked_at = '2026-08-18T06:18:00Z',
  assessment_status = 'Not Started',
  outreach_status = 'In Progress',
  status = 'scheduled',
  on_call = false
WHERE id = 'p23';

UPDATE public.patients SET
  ai_outcome_status = 'Aborted',
  ai_outcome_invoked_at = '2026-08-18T07:02:00Z',
  assessment_status = 'Not Started',
  outreach_status = 'Not Started',
  status = 'scheduled',
  on_call = false
WHERE id = 'p25';

UPDATE public.patients SET
  ai_outcome_status = 'Completed',
  ai_outcome_invoked_at = '2026-08-15T18:22:00Z',
  assessment_status = 'Completed',
  outreach_status = 'Completed',
  status = 'completed',
  on_call = false
WHERE id = 'p26';

-- Keep the first 5 demo rows blank until bulk invoke.
UPDATE public.patients SET
  ai_outcome_initiated = false,
  ai_outcome_status = NULL,
  ai_outcome_invoked_at = NULL,
  assessment_status = 'Not Started',
  outreach_status = 'Not Started',
  status = 'queued',
  on_call = false
WHERE id IN ('p1', 'p2', 'p3', 'p5', 'p8');

COMMIT;
