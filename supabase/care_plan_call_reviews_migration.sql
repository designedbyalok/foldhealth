-- A care plan reviewed with the patient on a call (Review care plan drawer,
-- opened from the worklist's Care Plan Status). One row per review: which
-- goals, interventions and barriers were discussed (with quick tags such as
-- "Patient reported"), and the general note for the call. A review stays
-- open (finished_at null) until Finish review, so closing the drawer mid-call
-- keeps what was ticked. Notes on individual items go to care_plan_audit as
-- usual.

CREATE TABLE IF NOT EXISTS public.care_plan_call_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.patient_care_plans(id) ON DELETE CASCADE,
  patient_id  text NOT NULL,
  program_id  text NOT NULL,
  -- { "goal:<id>": { "at": iso, "tags": ["Patient reported"] }, ... }
  discussed   jsonb NOT NULL DEFAULT '{}'::jsonb,
  call_note   text NOT NULL DEFAULT '',
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS care_plan_call_reviews_plan_idx
  ON public.care_plan_call_reviews (plan_id, created_at DESC);

ALTER TABLE public.care_plan_call_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage care_plan_call_reviews" ON public.care_plan_call_reviews;
CREATE POLICY "Staff manage care_plan_call_reviews" ON public.care_plan_call_reviews
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
