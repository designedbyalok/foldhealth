-- Event-based care plan updates (#84, CCP > Care Plan > Follow-up).
--
-- New patient data is captured as it is written, whoever writes it (EHR feed,
-- staff, the patient app):
--
--   care_plan_events   one row per clinical event, filled by triggers on
--     patient_clinical_events  ADT (admit / discharge / transfer / ED), labs,
--                              encounters, medications, PROMs, device readings
--     patient_vitals           a recorded vital
--     patient_medications      a medication started, changed or stopped
--     form_responses           a completed assessment (with its scores)
--     clinical_notes           a signed note (the encounter summary)
--
--   care_plan_event_impacts   one row per event and care plan (program),
--     written by the app when the plan is opened: whether the event touches
--     the plan (rules in care-plan/lib/eventImpact.js) and, when it does, the
--     proposed changes, drafted by rules and the AI (/api/care-plan-event-update):
--       changes [{ id, kind, targetType, targetId, targetTitle, from, to,
--                  item, rationale, source: 'rule'|'ai',
--                  decision: null|'accepted'|'dismissed', decidedBy, decidedAt }]
--     status  'no_impact' (evaluated, nothing to do), 'pending' (changes to
--             review), 'resolved' (every change accepted or dismissed).
--
-- The triggers never block the write they react to: any error is swallowed.
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.care_plan_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     text        NOT NULL,
  kind           text        NOT NULL CHECK (kind IN ('adt', 'lab', 'vital', 'medication', 'assessment', 'encounter', 'note', 'prom', 'device')),
  action         text,       -- adt: admit|discharge|transfer|ed; medication: started|changed|stopped; note: signed
  code           text,       -- LOINC / vital key / form id
  display        text        NOT NULL DEFAULT '',
  value_text     text,
  numeric_value  numeric,
  unit           text,
  abnormal       boolean     NOT NULL DEFAULT false,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  source_table   text        NOT NULL,
  source_id      text        NOT NULL,
  dedupe_key     text        NOT NULL UNIQUE,
  meta           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_plan_events_patient_idx ON public.care_plan_events (patient_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.care_plan_event_impacts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES public.care_plan_events(id) ON DELETE CASCADE,
  patient_id    text        NOT NULL,
  program_id    text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('no_impact', 'pending', 'resolved')),
  reasons       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  changes       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ai_summary    text,
  ai_error      text,
  evaluated_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   text,
  UNIQUE (event_id, program_id)
);
CREATE INDEX IF NOT EXISTS care_plan_event_impacts_plan_idx ON public.care_plan_event_impacts (patient_id, program_id, status);

ALTER TABLE public.care_plan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_event_impacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_plan_events_all ON public.care_plan_events;
CREATE POLICY care_plan_events_all ON public.care_plan_events
  FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS care_plan_event_impacts_all ON public.care_plan_event_impacts;
CREATE POLICY care_plan_event_impacts_all ON public.care_plan_event_impacts
  FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- One insert helper so every trigger dedupes the same way.
CREATE OR REPLACE FUNCTION public.record_care_plan_event(
  p_patient_id text, p_kind text, p_action text, p_code text, p_display text,
  p_value_text text, p_numeric numeric, p_unit text, p_abnormal boolean,
  p_occurred_at timestamptz, p_source_table text, p_source_id text, p_dedupe text, p_meta jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_patient_id IS NULL OR p_patient_id = '' THEN RETURN; END IF;
  INSERT INTO public.care_plan_events (patient_id, kind, action, code, display, value_text, numeric_value, unit,
                                       abnormal, occurred_at, source_table, source_id, dedupe_key, meta)
  VALUES (p_patient_id, p_kind, p_action, p_code, coalesce(p_display, ''), p_value_text, p_numeric, p_unit,
          coalesce(p_abnormal, false), coalesce(p_occurred_at, now()), p_source_table, p_source_id, p_dedupe, coalesce(p_meta, '{}'::jsonb))
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;

-- patient_clinical_events: ADT, labs, encounters, medications, PROMs, devices.
CREATE OR REPLACE FUNCTION public.care_plan_events_from_clinical_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_action text := lower(coalesce(NEW.raw_meta ->> 'action', ''));
BEGIN
  IF NEW.event_type NOT IN ('adt', 'lab', 'encounter', 'medication', 'prom', 'device') THEN RETURN NEW; END IF;
  BEGIN
    PERFORM public.record_care_plan_event(
      NEW.patient_id, NEW.event_type, nullif(v_action, ''), NEW.code, NEW.display,
      NULL, NEW.numeric_value, NEW.unit,
      NEW.numeric_value IS NOT NULL AND (
        (NEW.reference_low IS NOT NULL AND NEW.numeric_value < NEW.reference_low)
        OR (NEW.reference_high IS NOT NULL AND NEW.numeric_value > NEW.reference_high)),
      coalesce(CASE WHEN v_action = 'discharge' THEN NEW.end_date END, NEW.effective_date)::timestamptz,
      'patient_clinical_events', NEW.id::text, 'pce:' || NEW.id::text,
      jsonb_build_object('raw', NEW.raw_meta, 'referenceLow', NEW.reference_low, 'referenceHigh', NEW.reference_high, 'source', NEW.source));
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS care_plan_events_from_clinical_event ON public.patient_clinical_events;
CREATE TRIGGER care_plan_events_from_clinical_event
  AFTER INSERT ON public.patient_clinical_events
  FOR EACH ROW EXECUTE FUNCTION public.care_plan_events_from_clinical_event();

-- patient_vitals: a recorded vital (blood pressure keeps both parts).
CREATE OR REPLACE FUNCTION public.care_plan_events_from_vital()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    PERFORM public.record_care_plan_event(
      NEW.patient_id, 'vital', NULL, NEW.vital_key, NEW.vital_key,
      CASE WHEN NEW.value2 IS NOT NULL AND NEW.value2 <> '' THEN NEW.value || '/' || NEW.value2 ELSE NEW.value END,
      CASE WHEN NEW.value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN NEW.value::numeric END, NULL,
      NEW.flag, NEW.recorded_on::timestamptz,
      'patient_vitals', NEW.id::text, 'vital:' || NEW.id::text,
      jsonb_build_object('recordedBy', NEW.recorded_by));
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS care_plan_events_from_vital ON public.patient_vitals;
CREATE TRIGGER care_plan_events_from_vital
  AFTER INSERT ON public.patient_vitals
  FOR EACH ROW EXECUTE FUNCTION public.care_plan_events_from_vital();

-- patient_medications: started, stopped, or the dose / sig changed.
CREATE OR REPLACE FUNCTION public.care_plan_events_from_medication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'started';
  ELSIF lower(coalesce(NEW.status, '')) IN ('stopped', 'discontinued', 'inactive')
        AND lower(coalesce(OLD.status, '')) NOT IN ('stopped', 'discontinued', 'inactive') THEN v_action := 'stopped';
  ELSIF NEW.sig IS DISTINCT FROM OLD.sig OR NEW.name IS DISTINCT FROM OLD.name THEN v_action := 'changed';
  ELSE RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.record_care_plan_event(
      NEW.patient_id, 'medication', v_action, NULL, NEW.name, NEW.sig, NULL, NULL, false, now(),
      'patient_medications', NEW.id::text, 'med:' || NEW.id::text || ':' || v_action || ':' || extract(epoch FROM now())::bigint,
      jsonb_build_object('status', NEW.status, 'previousSig', CASE WHEN TG_OP = 'UPDATE' THEN OLD.sig END));
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS care_plan_events_from_medication ON public.patient_medications;
CREATE TRIGGER care_plan_events_from_medication
  AFTER INSERT OR UPDATE OF status, sig, name ON public.patient_medications
  FOR EACH ROW EXECUTE FUNCTION public.care_plan_events_from_medication();

-- form_responses: a completed assessment, with its first complete score.
CREATE OR REPLACE FUNCTION public.care_plan_events_from_assessment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name  text;
  v_score jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR NEW.patient_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;
  BEGIN
    SELECT f.name INTO v_name FROM public.forms f WHERE f.id = NEW.form_id;
    IF jsonb_typeof(NEW.scores -> 'scores') = 'array' THEN
      SELECT r INTO v_score FROM jsonb_array_elements(NEW.scores -> 'scores') r
       WHERE jsonb_typeof(r -> 'value') = 'number' AND r ->> 'status' = 'complete' LIMIT 1;
    END IF;
    PERFORM public.record_care_plan_event(
      NEW.patient_id::text, 'assessment', 'completed', NEW.form_id::text, coalesce(v_name, 'Assessment'),
      v_score ->> 'band', (v_score ->> 'value')::numeric, NULL, false,
      coalesce(NEW.completed_at, now()),
      'form_responses', NEW.id::text, 'form:' || NEW.id::text,
      jsonb_build_object('score', v_score));
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS care_plan_events_from_assessment ON public.form_responses;
CREATE TRIGGER care_plan_events_from_assessment
  AFTER INSERT OR UPDATE OF status ON public.form_responses
  FOR EACH ROW EXECUTE FUNCTION public.care_plan_events_from_assessment();

-- clinical_notes: a signed note is the encounter summary.
CREATE OR REPLACE FUNCTION public.care_plan_events_from_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'signed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'signed' THEN RETURN NEW; END IF;
  BEGIN
    PERFORM public.record_care_plan_event(
      NEW.patient_id, 'note', 'signed', NEW.form_type, NEW.form_type, NULL, NULL, NULL, false,
      coalesce(NEW.signed_at, now()),
      'clinical_notes', NEW.id::text, 'note:' || NEW.id::text,
      jsonb_build_object('author', NEW.author_name));
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS care_plan_events_from_note ON public.clinical_notes;
CREATE TRIGGER care_plan_events_from_note
  AFTER INSERT OR UPDATE OF status ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.care_plan_events_from_note();

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS care_plan_events_from_note ON public.clinical_notes;
-- DROP TRIGGER IF EXISTS care_plan_events_from_assessment ON public.form_responses;
-- DROP TRIGGER IF EXISTS care_plan_events_from_medication ON public.patient_medications;
-- DROP TRIGGER IF EXISTS care_plan_events_from_vital ON public.patient_vitals;
-- DROP TRIGGER IF EXISTS care_plan_events_from_clinical_event ON public.patient_clinical_events;
-- DROP FUNCTION IF EXISTS public.care_plan_events_from_note(), public.care_plan_events_from_assessment(),
--   public.care_plan_events_from_medication(), public.care_plan_events_from_vital(),
--   public.care_plan_events_from_clinical_event(), public.record_care_plan_event(text, text, text, text, text, text, numeric, text, boolean, timestamptz, text, text, text, jsonb);
-- DROP TABLE IF EXISTS public.care_plan_event_impacts;
-- DROP TABLE IF EXISTS public.care_plan_events;
