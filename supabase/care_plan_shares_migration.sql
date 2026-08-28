-- Care Plan shares — an audit row per time a plan (or a selection of it) is
-- previewed-and-shared to an external party.
--
-- THE HOLE THIS CLOSES
-- The care plan could only be "downloaded" as a whole document (a dead button,
-- in fact). There was no way to preview it, choose which goals/interventions to
-- include, share it to the EHR / patient / POA, or keep a record that it went
-- out (roadmap #8, #13, #40). This table records each share so the workflow is
-- real — and gives the E5 share-history view (#9) something to read.
--
-- WHAT THIS DOES
--   care_plan_shares — one row per share. target is who it went to
--   (ehr / patient / poa); format names the download template used; the two
--   id arrays capture exactly which goals & interventions were included, so a
--   partial share is faithfully recorded, not just "the plan".
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon`.
-- Staff clinical activity behind the signed-in app.

CREATE TABLE IF NOT EXISTS public.care_plan_shares (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       text NOT NULL,
  program_id       text NOT NULL,
  program_code     text,
  target           text NOT NULL,
  format           text NOT NULL DEFAULT 'standard',
  note             text NOT NULL DEFAULT '',
  goal_ids         uuid[] NOT NULL DEFAULT '{}',
  intervention_ids uuid[] NOT NULL DEFAULT '{}',
  shared_by        text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_plan_shares_patient_idx
  ON public.care_plan_shares (patient_id);
CREATE INDEX IF NOT EXISTS care_plan_shares_program_idx
  ON public.care_plan_shares (program_id);

ALTER TABLE public.care_plan_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage care_plan_shares" ON public.care_plan_shares;
CREATE POLICY "Staff manage care_plan_shares"
  ON public.care_plan_shares
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
