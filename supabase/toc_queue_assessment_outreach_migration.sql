-- TOC Queue redesign: replace the ambient "Next Action" and "AI Insights"
-- columns with two new patient-scoped statuses that each open a dedicated
-- drawer: Assessment and Outreach Status.
--
-- Scope
--   - Two new nullable TEXT columns on public.patients with CHECK constraints
--     so the app can only render a fixed set of pills.
--   - Backfill the 10 agent-assigned patients with realistic values so the
--     new columns look meaningful in the Agent Queue immediately.
--
-- The old next_action / ai_insights columns are intentionally NOT dropped,
-- the UI stops rendering them, but the data stays around for history + any
-- other consumers.

BEGIN;

-- Assessment: where the patient is in the post-discharge assessment flow.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS assessment_status TEXT
    CHECK (assessment_status IN ('Not Started','In Progress','Completed','Overdue'));

-- Outreach Status: the state of the outreach effort for this patient.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS outreach_status TEXT
    CHECK (outreach_status IN ('Not Started','In Progress','Attempted','Completed'));

-- Seed values for the 10 agent-assigned patients, spread across every
-- enum value so the pill styling gets exercised end-to-end.
UPDATE public.patients SET assessment_status = 'In Progress', outreach_status = 'In Progress' WHERE id = 'p1';
UPDATE public.patients SET assessment_status = 'Completed',  outreach_status = 'Completed'   WHERE id = 'p3';
UPDATE public.patients SET assessment_status = 'Overdue',    outreach_status = 'Attempted'   WHERE id = 'p8';
UPDATE public.patients SET assessment_status = 'Not Started',outreach_status = 'Not Started' WHERE id = 'p9';
UPDATE public.patients SET assessment_status = 'In Progress',outreach_status = 'Attempted'   WHERE id = 'p12';
UPDATE public.patients SET assessment_status = 'Completed',  outreach_status = 'In Progress' WHERE id = 'p14';
UPDATE public.patients SET assessment_status = 'Overdue',    outreach_status = 'Not Started' WHERE id = 'p17';
UPDATE public.patients SET assessment_status = 'In Progress',outreach_status = 'Completed'   WHERE id = 'p20';
UPDATE public.patients SET assessment_status = 'Not Started',outreach_status = 'In Progress' WHERE id = 'p23';
UPDATE public.patients SET assessment_status = 'Completed',  outreach_status = 'Attempted'   WHERE id = 'p26';

COMMIT;
