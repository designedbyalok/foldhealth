-- Care Plan links — attach existing Fold primitives (tasks, appointments) to a
-- specific goal / intervention / barrier on a care plan (roadmap #11).
--
-- THE HOLE THIS CLOSES
-- The LinkChip on every goal/intervention/barrier was decorative — a count with
-- no data behind it and a click that only toasted. A care manager could not say
-- "this goal is supported by that follow-up appointment and this outreach task",
-- regardless of where those primitives were created. This table records those
-- links so the chip is real and the relationships persist.
--
-- WHAT THIS DOES
--   care_plan_links — one row per link. owner_type + owner_id point at the GBI
--   the link hangs off; entity_type + entity_id + entity_label capture the
--   linked primitive (a task or an appointment) by reference, so the link
--   survives even if the primitive is later edited. A UNIQUE constraint stops
--   the same primitive being linked to the same owner twice.
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon`.

CREATE TABLE IF NOT EXISTS public.care_plan_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES public.patient_care_plans(id) ON DELETE CASCADE,
  patient_id   text NOT NULL,
  program_id   text NOT NULL,
  owner_type   text NOT NULL,
  owner_id     text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  entity_label text NOT NULL DEFAULT '',
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS care_plan_links_plan_idx ON public.care_plan_links (plan_id);
CREATE INDEX IF NOT EXISTS care_plan_links_owner_idx ON public.care_plan_links (owner_id);

ALTER TABLE public.care_plan_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage care_plan_links" ON public.care_plan_links;
CREATE POLICY "Staff manage care_plan_links"
  ON public.care_plan_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
