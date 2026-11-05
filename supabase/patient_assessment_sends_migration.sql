-- Assessments sent to a patient (P360 Assessments tab, Send Assessment drawer).
-- One row per form per send. The form's answers stay in form_responses; this
-- table holds what the send knows: who sent it, when, for which programs,
-- and whether the assessment needs (and has) a clinician's signature.
CREATE TABLE IF NOT EXISTS patient_assessment_sends (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         text NOT NULL,
  form_id            bigint NOT NULL,
  sent_by_id         uuid,
  sent_by_name       text,
  sent_at            timestamptz NOT NULL DEFAULT now(),
  channels           text[] NOT NULL DEFAULT '{}',
  program_codes      text[] NOT NULL DEFAULT '{}',
  requires_signature boolean NOT NULL DEFAULT false,
  signed_by_name     text,
  signed_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_assessment_sends_patient_idx ON patient_assessment_sends (patient_id, sent_at DESC);
ALTER TABLE patient_assessment_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_assessment_sends" ON patient_assessment_sends;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Allow all on patient_assessment_sends" ON patient_assessment_sends FOR ALL TO authenticated USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
