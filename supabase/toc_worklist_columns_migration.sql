-- TOC worklist: persist care-team assignees, tags, and radar / risk IQ
-- on public.patients. These columns are edited from the TOC worklist
-- (nurse / health coach, coordinator, social worker, community health
-- worker, plus display-only radar / risk IQ / tags). Without them the
-- app's patientMapper drops the keys and a refresh wipes the edits.
--
-- Hash-fallback sample names stay in the UI when these columns are
-- null; user edits write through updatePatient → persistPatient.

BEGIN;

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nurse_coach TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nurse_coach_initials TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS coordinator TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS coordinator_initials TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS social_worker TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS social_worker_initials TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS community_health_worker TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS community_health_worker_initials TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS tags_more INT DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS radar TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS risk_iq TEXT;

COMMIT;
