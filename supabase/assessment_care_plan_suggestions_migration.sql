-- Assessment-to-template mapping: care plan templates suggested by a
-- completed assessment.
--
-- A form's scoring holds `carePlanMappings` (form builder, Care Plan tab):
--   { id, kind: 'score',  scoreId, min, max, templateIds }   score in [min, max]
--   { id, kind: 'answer', linkId, values,    templateIds }   answer is any of values
-- min or max may be null (open-ended): PHQ-9 >= 10 is { min: 10, max: null }.
--
-- When a response with a patient becomes completed (staff form view, or the
-- patient app's patient_submit_form), this trigger matches the mappings
-- against the response's score snapshot (the same engine computed it at
-- submit) and answers, and records one pending suggestion per template. The
-- care plan's Recommended section reads the pending ones.
--
-- A score only counts when complete (or partial, if the score allows partial
-- bands), so a half-filled PHQ-9 never suggests on a low total. A template
-- already pending for the patient isn't suggested twice. Matching never
-- blocks a submission: any error is logged as a warning and skipped.
--
-- Additive and idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.assessment_care_plan_suggestions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        text NOT NULL,
  template_id       uuid NOT NULL REFERENCES public.care_plan_templates(id) ON DELETE CASCADE,
  form_id           bigint,
  form_response_id  bigint,
  mapping_id        text,
  program_codes     text[] NOT NULL DEFAULT '{}',
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  resolved_by       uuid,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_response_id, template_id)
);
CREATE INDEX IF NOT EXISTS assessment_care_plan_suggestions_patient_idx
  ON public.assessment_care_plan_suggestions (patient_id, status, created_at DESC);

ALTER TABLE public.assessment_care_plan_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on assessment_care_plan_suggestions" ON public.assessment_care_plan_suggestions;
-- Signed-in staff only; the add_staff_only_policy event trigger adds the
-- restrictive staff_only gate on top, so patients never read these.
CREATE POLICY "Allow all on assessment_care_plan_suggestions" ON public.assessment_care_plan_suggestions
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

CREATE OR REPLACE FUNCTION public.suggest_care_plan_templates_from_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_form      record;
  v_rule      jsonb;
  v_def       jsonb;
  v_score     jsonb;
  v_value     numeric;
  v_answer    jsonb;
  v_matched   text[];
  v_reason    text;
  v_programs  text[];
  v_tid       text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR NEW.patient_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  BEGIN
    SELECT f.name, f.schema, f.scoring INTO v_form FROM public.forms f WHERE f.id = NEW.form_id;
    IF v_form.scoring IS NULL OR jsonb_typeof(v_form.scoring -> 'carePlanMappings') IS DISTINCT FROM 'array' THEN
      RETURN NEW;
    END IF;

    SELECT s.program_codes INTO v_programs
      FROM public.patient_assessment_sends s
     WHERE s.patient_id = NEW.patient_id AND s.form_id = NEW.form_id
     ORDER BY s.sent_at DESC LIMIT 1;

    FOR v_rule IN SELECT * FROM jsonb_array_elements(v_form.scoring -> 'carePlanMappings') LOOP
      v_reason := NULL;

      IF v_rule ->> 'kind' = 'score' THEN
        SELECT d INTO v_def FROM jsonb_array_elements(coalesce(v_form.scoring -> 'scores', '[]')) d
         WHERE d ->> 'id' = v_rule ->> 'scoreId' LIMIT 1;
        v_score := NULL;
        IF jsonb_typeof(NEW.scores -> 'scores') = 'array' THEN
          SELECT r INTO v_score FROM jsonb_array_elements(NEW.scores -> 'scores') r
           WHERE r ->> 'id' = v_rule ->> 'scoreId' LIMIT 1;
        END IF;
        IF v_score IS NOT NULL
           AND jsonb_typeof(v_score -> 'value') = 'number'
           AND (v_score ->> 'status' = 'complete'
                OR (v_score ->> 'status' = 'partial' AND coalesce((v_def ->> 'showPartialScore')::boolean, false))) THEN
          v_value := (v_score ->> 'value')::numeric;
          IF (jsonb_typeof(v_rule -> 'min') IS DISTINCT FROM 'number' OR v_value >= (v_rule ->> 'min')::numeric)
             AND (jsonb_typeof(v_rule -> 'max') IS DISTINCT FROM 'number' OR v_value <= (v_rule ->> 'max')::numeric) THEN
            v_reason := format('%s score %s on %s', coalesce(v_def ->> 'label', v_rule ->> 'scoreId'),
                               trim_scale(v_value), coalesce(v_form.name, 'assessment'));
          END IF;
        END IF;

      ELSIF v_rule ->> 'kind' = 'answer' THEN
        v_answer := NEW.answers -> (v_rule ->> 'linkId');
        IF v_answer IS NOT NULL AND jsonb_typeof(v_rule -> 'values') = 'array' THEN
          SELECT array_agg(a) INTO v_matched
            FROM jsonb_array_elements_text(
                   CASE WHEN jsonb_typeof(v_answer) = 'array' THEN v_answer ELSE jsonb_build_array(v_answer) END) a
           WHERE a IN (SELECT jsonb_array_elements_text(v_rule -> 'values'));
          IF v_matched IS NOT NULL THEN
            v_reason := format('Answered "%s" to "%s" on %s', array_to_string(v_matched, ', '),
                               coalesce(jsonb_path_query_first(v_form.schema, '$.** ? (@.linkId == $id)',
                                          jsonb_build_object('id', v_rule ->> 'linkId')) ->> 'text', v_rule ->> 'linkId'),
                               coalesce(v_form.name, 'assessment'));
          END IF;
        END IF;
      END IF;

      CONTINUE WHEN v_reason IS NULL OR jsonb_typeof(v_rule -> 'templateIds') IS DISTINCT FROM 'array';

      FOR v_tid IN SELECT jsonb_array_elements_text(v_rule -> 'templateIds') LOOP
        CONTINUE WHEN v_tid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.care_plan_templates t WHERE t.id = v_tid::uuid);
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.assessment_care_plan_suggestions x
                               WHERE x.patient_id = NEW.patient_id AND x.template_id = v_tid::uuid AND x.status = 'pending'
                                 AND x.form_response_id IS DISTINCT FROM NEW.id);
        -- Several rules of one response naming the same template: one
        -- suggestion listing every reason.
        INSERT INTO public.assessment_care_plan_suggestions AS s
          (patient_id, template_id, form_id, form_response_id, mapping_id, program_codes, reason)
        VALUES
          (NEW.patient_id, v_tid::uuid, NEW.form_id, NEW.id, v_rule ->> 'id', coalesce(v_programs, '{}'), v_reason)
        ON CONFLICT (form_response_id, template_id) DO UPDATE SET reason = s.reason || '; ' || excluded.reason;
      END LOOP;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'suggest_care_plan_templates_from_response(%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.suggest_care_plan_templates_from_response() FROM public, anon;

DROP TRIGGER IF EXISTS form_responses_suggest_care_plan_templates ON public.form_responses;
CREATE TRIGGER form_responses_suggest_care_plan_templates
  AFTER INSERT OR UPDATE OF status ON public.form_responses
  FOR EACH ROW EXECUTE FUNCTION public.suggest_care_plan_templates_from_response();

COMMIT;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   drop trigger if exists form_responses_suggest_care_plan_templates on public.form_responses;
--   drop function if exists public.suggest_care_plan_templates_from_response();
--   drop table if exists public.assessment_care_plan_suggestions;
