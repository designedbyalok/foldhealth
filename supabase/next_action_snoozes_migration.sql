-- Snoozes on the Home Today next-action list (review F-24). A snooze always
-- carries a reason and an until-date, belongs to the user who set it, and
-- ends on its own once the date arrives. Regulatory deadlines (TCM 2-day
-- contact, 7-day visit) can't be snoozed; the UI enforces that.
-- See src/features/home/today/TodayView.jsx.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.next_action_snoozes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key       text NOT NULL,
  member_id      text,
  reason         text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 200),
  note           text,
  snoozed_until  date NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

ALTER TABLE public.next_action_snoozes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own snoozes"   ON public.next_action_snoozes;
DROP POLICY IF EXISTS "insert own snoozes" ON public.next_action_snoozes;
DROP POLICY IF EXISTS "update own snoozes" ON public.next_action_snoozes;
DROP POLICY IF EXISTS "delete own snoozes" ON public.next_action_snoozes;

CREATE POLICY "read own snoozes"
  ON public.next_action_snoozes FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "insert own snoozes"
  ON public.next_action_snoozes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "update own snoozes"
  ON public.next_action_snoozes FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "delete own snoozes"
  ON public.next_action_snoozes FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
