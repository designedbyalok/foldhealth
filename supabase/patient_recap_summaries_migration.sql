-- Unity's Recap summaries, saved so reopening the Recap shows the last ones
-- instead of writing them again. One row per user, patient and period; the
-- user replaces it with Refresh. Owner-only, like patient_reminders.
-- See src/features/patient/right-panel/tabs/overview/attention/RecapDialog.jsx.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.patient_recap_summaries (
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id     text NOT NULL,
  period        text NOT NULL,
  summaries     jsonb NOT NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, member_id, period)
);

ALTER TABLE public.patient_recap_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own recap summaries"   ON public.patient_recap_summaries;
DROP POLICY IF EXISTS "insert own recap summaries" ON public.patient_recap_summaries;
DROP POLICY IF EXISTS "update own recap summaries" ON public.patient_recap_summaries;
DROP POLICY IF EXISTS "delete own recap summaries" ON public.patient_recap_summaries;

CREATE POLICY "read own recap summaries"
  ON public.patient_recap_summaries FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "insert own recap summaries"
  ON public.patient_recap_summaries FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "update own recap summaries"
  ON public.patient_recap_summaries FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "delete own recap summaries"
  ON public.patient_recap_summaries FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.patient_recap_summaries;
