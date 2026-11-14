-- Retires the clinical protocols in the old layout (no care plan scope):
-- Fold's six built-in protocols (source_kind 'fold') and the seeded Harbor
-- Health "Hypertension Clinical Practice Guidance" v2.1. They are replaced by
-- the common-condition protocols uploaded from
-- supabase/clinical_protocol_guidance/ through the normal upload, scope and
-- approve flow.
--
-- Their starter care plan templates: ones no patient uses are deleted; ones a
-- patient care plan uses are kept, unlinked from the protocol and renamed
-- "(legacy)" so they don't clash with the new templates. Patient care plans
-- are not touched.
--
-- Idempotent.

BEGIN;

CREATE TEMP TABLE legacy_protocols ON COMMIT DROP AS
  SELECT id FROM public.clinical_protocols
  WHERE source_kind = 'fold'
     OR id = '5f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

CREATE TEMP TABLE legacy_templates ON COMMIT DROP AS
  SELECT t.id,
         EXISTS (SELECT 1 FROM public.patient_care_plans p WHERE t.id = ANY (p.applied_template_ids))
      OR EXISTS (SELECT 1 FROM public.patient_care_plan_template_instances i WHERE i.template_id = t.id) AS in_use
  FROM public.care_plan_templates t
  WHERE (t.source_protocol->>'id')::uuid IN (SELECT id FROM legacy_protocols);

DELETE FROM public.care_plan_templates
WHERE id IN (SELECT id FROM legacy_templates WHERE NOT in_use);

UPDATE public.care_plan_templates
SET name = name || ' (legacy)', source_protocol = NULL, updated_at = now()
WHERE id IN (SELECT id FROM legacy_templates WHERE in_use)
  AND name NOT LIKE '% (legacy)';

DELETE FROM public.clinical_protocols WHERE id IN (SELECT id FROM legacy_protocols);

COMMIT;
