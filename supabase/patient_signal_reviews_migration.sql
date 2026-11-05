-- Needs Attention reviews: which of a patient's Overview signals the care
-- team has looked at. A signal (a missed visit, an abnormal lab, a vital off
-- goal, ...) is derived from existing tables; this table only records that
-- someone reviewed it, so the band empties as the team works it and shows
-- who reviewed what. signal_id is stable for the same underlying fact and
-- changes when the fact does (a new reading re-raises the vital).
-- See src/features/patient/right-panel/tabs/overview/attention/attentionSignals.js.
--
-- Shared by the team: any signed-in user reads every review and records
-- their own. Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.patient_signal_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         text NOT NULL,
  signal_id         text NOT NULL,
  reviewed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name  text,
  reviewed_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_signal_reviews_unique UNIQUE (member_id, signal_id)
);

CREATE INDEX IF NOT EXISTS patient_signal_reviews_member_idx
  ON public.patient_signal_reviews (member_id);

ALTER TABLE public.patient_signal_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read signal reviews"   ON public.patient_signal_reviews;
DROP POLICY IF EXISTS "insert signal reviews" ON public.patient_signal_reviews;
DROP POLICY IF EXISTS "update signal reviews" ON public.patient_signal_reviews;
DROP POLICY IF EXISTS "delete signal reviews" ON public.patient_signal_reviews;

CREATE POLICY "read signal reviews"
  ON public.patient_signal_reviews FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "insert signal reviews"
  ON public.patient_signal_reviews FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = reviewed_by);

CREATE POLICY "update signal reviews"
  ON public.patient_signal_reviews FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK ((select auth.uid()) = reviewed_by);

-- Un-reviewing puts the signal back for everyone, so any teammate may do it.
CREATE POLICY "delete signal reviews"
  ON public.patient_signal_reviews FOR DELETE TO authenticated
  USING (true);
