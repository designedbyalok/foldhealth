-- Bulk appointment jobs (Calendar List view → Bulk Reschedule → Save, and
-- Cancel Appointments for several at once).
--
-- A job is a confirmed set of changes to several appointments: new times
-- (kind 'reschedule') or cancellation with a reason (kind 'cancel'). The job
-- carries them out and keeps the outcome here, which feeds the "summary is
-- ready" notification and the Appointment Rescheduling / Cancellation
-- Summary drawer (as reassignment_jobs does for reassignments).
--
-- Shared by every signed-in user; anon gets no access (as reassignment_jobs).

CREATE TABLE IF NOT EXISTS public.appointment_bulk_jobs (
  id            text PRIMARY KEY,
  kind          text NOT NULL,             -- 'reschedule' | 'cancel'
  provider      text,                      -- whose appointments (by name); null when several
  provider_id   text,
  provider_role text,
  reason        text,                      -- the cancel reason, for 'cancel'
  status        text NOT NULL DEFAULT 'done',   -- 'running' | 'done'
  done_count    integer NOT NULL DEFAULT 0,      -- rescheduled or cancelled
  failed_count  integer NOT NULL DEFAULT 0,
  -- One entry per appointment:
  -- { appointmentId, outcome: 'done'|'failed', reason?,
  --   appointment: { patientName, date, timeStart, timeEnd, type, location, provider },
  --   to?: { date, timeStart, timeEnd } }   (the new time, for 'reschedule')
  results       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_bulk_jobs_created_idx ON public.appointment_bulk_jobs (created_at DESC);
ALTER TABLE public.appointment_bulk_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on appointment_bulk_jobs" ON public.appointment_bulk_jobs;
CREATE POLICY "Allow all on appointment_bulk_jobs" ON public.appointment_bulk_jobs
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
