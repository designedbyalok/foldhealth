-- Care program suggested actions (care management redesign prototype): what
-- a new event (ADT, eFax, imaging, lab) means for a patient's care
-- programs. One row per suggestion, keyed by Fold ID (member_id), with the
-- event it came from and the action it takes:
--   action.type enroll {code} | step {code, step} | task {code, name, due, priority} | review {}
-- status: open until someone acts on it (done) or dismisses it.
-- RLS follows my_patients_worklist: signed-in staff read; writes need an
-- active staff profile. Seed: program_event_suggestions_seed.sql (Dev).
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.program_event_suggestions (
  id            text PRIMARY KEY,
  member_id     text NOT NULL,
  event_kind    text NOT NULL CHECK (event_kind IN ('adt', 'efax', 'imaging', 'lab')),
  event_title   text NOT NULL,
  event_detail  text,
  event_source  text,
  occurred_at   text NOT NULL,
  program_code  text NOT NULL,
  suggestion    text NOT NULL,
  action        jsonb NOT NULL DEFAULT '{"type":"review"}'::jsonb,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS program_event_suggestions_member_idx ON public.program_event_suggestions (member_id);

ALTER TABLE public.program_event_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS program_event_suggestions_select ON public.program_event_suggestions;
CREATE POLICY program_event_suggestions_select
  ON public.program_event_suggestions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS program_event_suggestions_write ON public.program_event_suggestions;
CREATE POLICY program_event_suggestions_write
  ON public.program_event_suggestions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'));

-- ── Rollback ──────────────────────────────────────────────────────────────
--   drop table if exists public.program_event_suggestions;
