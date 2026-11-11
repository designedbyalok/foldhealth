-- My Patients worklist (care management redesign prototype): the patients a
-- care manager works, one row per patient, keyed by Fold ID (member_id) so a
-- row opens the real chart. The store's fetchMyPatients maps these columns
-- onto the worklist row (src/features/my-patients/data/mock.js has the same
-- shape). Dates are MM/DD/YYYY text, like the other program worklists.
--
-- plan adherence is 0 to 100, recalculated nightly from interventions on
-- schedule (40%), tasks done on time (25%), goal reviews current (20%) and
-- reachable on the preferred channel (15%); bands: On Track 75+, At Risk
-- 55 to 74, Off Track below 55.
--
-- RLS follows cmp_members: signed-in staff read the roster; writes need an
-- active staff profile. Seed: supabase/my_patients_worklist_seed.sql (Dev).
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.my_patients_worklist (
  id                   text PRIMARY KEY,
  member_id            text NOT NULL,
  name                 text NOT NULL,
  initials             text,
  gender               text,
  age                  integer,
  dob                  text,
  language             text DEFAULT 'en',
  payer                text,
  programs             text[] NOT NULL DEFAULT '{}',
  conditions           text[] NOT NULL DEFAULT '{}',
  adherence            integer,
  adherence_prev       integer,
  why_points           jsonb NOT NULL DEFAULT '[]'::jsonb,
  why_summary          text,
  why_generated_at     timestamptz,
  last_review          text,
  review_cadence_days  integer,
  minutes_program      text,
  minutes_logged       integer,
  minutes_target       integer,
  last_touch_date      text,
  last_touch_channel   text,
  last_touch_by        text,
  assignee             text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS my_patients_worklist_assignee_idx ON public.my_patients_worklist (assignee);

ALTER TABLE public.my_patients_worklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS my_patients_worklist_select ON public.my_patients_worklist;
CREATE POLICY my_patients_worklist_select
  ON public.my_patients_worklist FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS my_patients_worklist_write ON public.my_patients_worklist;
CREATE POLICY my_patients_worklist_write
  ON public.my_patients_worklist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'));

-- ── Rollback ──────────────────────────────────────────────────────────────
--   drop table if exists public.my_patients_worklist;
