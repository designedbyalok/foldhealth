-- Patient event and touchpoint stream (patient monitoring Phase 1B).
--
-- The patient's Timeline reads one stream built from the tables that already
-- hold each kind of record (src/features/patient/data/patientStream.js):
-- clinical events, medications, CRM touchpoints, calls, notes, appointments,
-- assessments and program activity. This adds what those tables lacked:
--
-- patient_clinical_events.event_type also takes
--   adt     admit / discharge / transfer / ED visit; raw_meta holds
--           { action, facility, disposition, followUp }
--   device  a device reading (raw_meta: { device })
--   prom    a patient-reported outcome (raw_meta: { score, instrument })
--
-- patient_crm_activities (each touchpoint) gains
--   program_code      the program the touchpoint supports
--   billing_program   the program its time bills to (when different)
--   duration_seconds  how long it took
--   vendor_name       the delegated vendor that made it, if any
--
-- Additive and idempotent. Both tables keep their existing RLS (signed-in
-- users only).

ALTER TABLE public.patient_clinical_events DROP CONSTRAINT IF EXISTS patient_clinical_events_event_type_check;
ALTER TABLE public.patient_clinical_events
  ADD CONSTRAINT patient_clinical_events_event_type_check CHECK (
    event_type IN ('diagnosis', 'procedure', 'medication', 'lab', 'encounter', 'immunization', 'adt', 'device', 'prom')
  );

ALTER TABLE public.patient_crm_activities
  ADD COLUMN IF NOT EXISTS program_code     text,
  ADD COLUMN IF NOT EXISTS billing_program  text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS vendor_name      text;

CREATE INDEX IF NOT EXISTS patient_crm_activities_patient_idx
  ON public.patient_crm_activities (patient_id, occurred_at DESC);
