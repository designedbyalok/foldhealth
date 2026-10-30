-- VBC-25651: calendar List view with bulk Reschedule, Reassign and Cancel.
--
-- 1. appointment_cancel_reasons: the reasons the Cancel Appointments dialog
--    offers (seeded by `bun run seed` from
--    src/features/calendar/list/cancelReasons.js).
-- 2. appointments.cancel_reason / cancelled_at / cancelled_by: why, when and
--    by whom an appointment was cancelled.
--
-- Additive and idempotent: safe to run more than once. The app works before
-- it runs (the dialog falls back to the built-in reasons, and a cancel
-- saves just the status).

CREATE TABLE IF NOT EXISTS public.appointment_cancel_reasons (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointment_cancel_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on appointment_cancel_reasons" ON public.appointment_cancel_reasons;
CREATE POLICY "Allow all on appointment_cancel_reasons" ON public.appointment_cancel_reasons
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

INSERT INTO public.appointment_cancel_reasons (id, label, sort_order) VALUES
  ('cr-covid-fears', 'Covid Fears', 1),
  ('cr-doctor-canceled', 'Doctor Cancelled appointment', 2),
  ('cr-death-in-family', 'Death in the family', 3),
  ('cr-no-show', 'No show', 4),
  ('cr-no-show-no-call', 'No Show - No Call', 5)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, active = true;

-- Reasons from an earlier list, off if they were already added.
UPDATE public.appointment_cancel_reasons SET active = false
 WHERE id IN ('cr-cancellation-test', 'cr-new-cancellation');

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancelled_by text;

NOTIFY pgrst, 'reload schema';
