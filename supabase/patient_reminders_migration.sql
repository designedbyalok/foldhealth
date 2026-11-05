-- Private reminders a user sets for themselves on a patient, shown in the
-- Reminders card on that patient's Overview. Only the user who created a
-- reminder can see or change it; teammates never see it.
-- See src/features/patient/right-panel/tabs/overview/cards/RemindersCard.jsx.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.patient_reminders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id   text NOT NULL,
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  note        text,
  remind_at   timestamptz NOT NULL,
  done_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_reminders_user_member_idx
  ON public.patient_reminders (user_id, member_id, remind_at);

CREATE OR REPLACE FUNCTION public.touch_patient_reminders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_patient_reminders ON public.patient_reminders;
CREATE TRIGGER trg_touch_patient_reminders
  BEFORE UPDATE ON public.patient_reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_patient_reminders_updated_at();

ALTER TABLE public.patient_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own reminders"   ON public.patient_reminders;
DROP POLICY IF EXISTS "insert own reminders" ON public.patient_reminders;
DROP POLICY IF EXISTS "update own reminders" ON public.patient_reminders;
DROP POLICY IF EXISTS "delete own reminders" ON public.patient_reminders;

CREATE POLICY "read own reminders"
  ON public.patient_reminders FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "insert own reminders"
  ON public.patient_reminders FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "update own reminders"
  ON public.patient_reminders FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "delete own reminders"
  ON public.patient_reminders FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
