-- Care plan templates: who a template is for.
--
--   org      the organization library; everyone sees and edits it
--   user     private to its creator (owner_user_id)
--   patient  saved from one patient's care plan; shows in that patient's
--            Apply Templates for anyone working on the patient
--
-- owner_user_id records the creator for every scope (it drives the "Mine"
-- filter), and is what makes a 'user' template private. Existing templates
-- were shared with everyone, so they become 'org'.
--
-- Privacy is enforced here, not just filtered in the UI: a 'user' template
-- is only readable or writable by its owner.

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'org',
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS patient_id text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_plan_templates_scope_check') THEN
    ALTER TABLE public.care_plan_templates
      ADD CONSTRAINT care_plan_templates_scope_check
      CHECK (
        scope IN ('org', 'user', 'patient')
        AND (scope <> 'user' OR owner_user_id IS NOT NULL)
        AND (scope <> 'patient' OR patient_id IS NOT NULL)
      );
  END IF;
END $$;

-- Apply Templates looks a patient's templates up by patient.
CREATE INDEX IF NOT EXISTS care_plan_templates_patient_idx
  ON public.care_plan_templates (patient_id) WHERE scope = 'patient';

DROP POLICY IF EXISTS "Staff manage care_plan_templates" ON public.care_plan_templates;
DROP POLICY IF EXISTS "Staff read care_plan_templates" ON public.care_plan_templates;
DROP POLICY IF EXISTS "Staff write care_plan_templates" ON public.care_plan_templates;

CREATE POLICY "Staff read care_plan_templates" ON public.care_plan_templates
  FOR SELECT TO authenticated
  USING (scope <> 'user' OR owner_user_id = auth.uid());

CREATE POLICY "Staff write care_plan_templates" ON public.care_plan_templates
  FOR ALL TO authenticated
  USING (scope <> 'user' OR owner_user_id = auth.uid())
  WITH CHECK (scope <> 'user' OR owner_user_id = auth.uid());
