-- Program eligibility (care management redesign prototype, Eligible
-- Programs): Unity's finding, per patient and program they aren't enrolled
-- in, from the problem list, labs, payer rules and consents. The Care
-- Programs tab lists them with Enroll; whether consent is still needed and
-- whether the patient is already enrolled are worked out live in the app.
-- fit: 'eligible' or 'check' (a person confirms first). Keyed by Fold ID.
-- RLS follows my_patients_worklist. Seed: program_eligibility_seed.sql (Dev).
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.program_eligibility (
  id          text PRIMARY KEY,
  member_id   text NOT NULL,
  code        text NOT NULL,
  fit         text NOT NULL DEFAULT 'eligible' CHECK (fit IN ('eligible', 'check')),
  why         text NOT NULL,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS program_eligibility_member_idx ON public.program_eligibility (member_id);

ALTER TABLE public.program_eligibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS program_eligibility_select ON public.program_eligibility;
CREATE POLICY program_eligibility_select
  ON public.program_eligibility FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS program_eligibility_write ON public.program_eligibility;
CREATE POLICY program_eligibility_write
  ON public.program_eligibility FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'));

-- ── Rollback ──────────────────────────────────────────────────────────────
--   drop table if exists public.program_eligibility;
