-- Care plan auto-apply on enrollment, built from Settings > Automations nodes:
--   A patient is enrolled in a care program (trigger, programCodes)
--   → Patient matches clinical criteria (condition)
--   → Attach care plan templates (action: drafts + one review task)
-- Active for the chronic and high-intensity programs. Re-runnable: fixed ids,
-- upserted. The existing "Diabetes + HbA1c > 9" automation (5936f78f…) is
-- activated and scoped to the same programs.

WITH programs AS (SELECT '["HICM", "CMP", "DM", "SNP", "CCM"]'::jsonb AS codes),
rules (id, name, description, match, criteria, template_id, template_name) AS (VALUES
  ('f05f78d8-8cc2-5210-b931-cc2183270667'::uuid,
   'Diabetes above goal → Diabetes Management',
   'Diabetes with an HbA1c at or above 7% in the last 180 days gets the diabetes care plan template for review.',
   'all',
   '[{"type": "condition", "value": "Diabetes"}, {"type": "lab", "lab": "hba1c", "op": ">=", "value": 7, "withinDays": 180}]'::jsonb,
   'bd9f4e6f-a29a-5802-9f8f-6a30ae61a5d7', 'Diabetes Management'),
  ('151a04b0-7ccb-5cc3-b47b-0196a52dbcc5'::uuid,
   'Diabetic kidney risk → Chronic Kidney Disease',
   'Diabetes with a urine albumin-to-creatinine ratio above 30 mg/g in the last 180 days gets the kidney care plan template for review.',
   'all',
   '[{"type": "condition", "value": "Diabetes"}, {"type": "lab", "lab": "uacr", "op": ">", "value": 30, "withinDays": 180}]'::jsonb,
   'b5d440e0-c574-5963-be30-eaa1122ecab0', 'Chronic Kidney Disease'),
  ('075d2409-49f7-590b-af22-b9be7bccbca7'::uuid,
   'Recent ED visit → ER Visit Reduction',
   'An emergency department visit in the last 180 days gets the ER visit reduction template for review.',
   'all',
   '[{"type": "event", "event": "ed", "withinDays": 180}]'::jsonb,
   'f607c728-ef6b-5cd7-83d0-ecbb8483773b', 'ER Visit Reduction'),
  ('8119c19f-e78f-570d-a033-44feb3b2d590'::uuid,
   'Heart failure → Heart Failure Management',
   'An active heart failure diagnosis gets the heart failure care plan template for review.',
   'all',
   '[{"type": "condition", "value": "Heart failure"}]'::jsonb,
   'a9ced5ae-c094-5bbd-85ff-a23c247f8332', 'Heart Failure Management'),
  ('1e462366-da23-5e6a-b19c-1f017f7a7a8d'::uuid,
   'Tobacco use → Tobacco Cessation',
   'Nicotine dependence on the problem list gets the tobacco cessation template for review.',
   'all',
   '[{"type": "condition", "value": "Nicotine"}]'::jsonb,
   'ab712502-b1f8-5517-b534-ba054a9af46f', 'Tobacco Cessation'),
  ('6e8fe0e0-5f3c-5ad0-8ae8-47169f11c076'::uuid,
   'Depression screen → Behavioral Health Support',
   'A latest PHQ-9 of 10 or more in the last 90 days gets the behavioral health template for review.',
   'all',
   '[{"type": "score", "score": "phq9", "op": ">=", "value": 10, "withinDays": 90}]'::jsonb,
   '1616a883-bf00-5444-adef-cacd57535354', 'Behavioral Health Support')
)
INSERT INTO automations (id, name, description, status, schedule, graph, created_by, updated_by)
SELECT r.id, r.name, r.description, 'active', 'onTrigger',
  jsonb_build_object('nodes', jsonb_build_array(
    jsonb_build_object('id', 'trigger', 'type', 'careProgramEnrolled', 'parentId', null, 'branch', null, 'order', 0,
      'config', jsonb_build_object('programCodes', p.codes)),
    jsonb_build_object('id', 'criteria', 'type', 'clinicalCriteria', 'parentId', 'trigger', 'branch', 'next', 'order', 0,
      'config', jsonb_build_object('match', r.match, 'criteria', r.criteria)),
    jsonb_build_object('id', 'attach', 'type', 'attachCarePlan', 'parentId', 'criteria', 'branch', 'next', 'order', 0,
      'config', jsonb_build_object('reviewer', null, 'templateIds', jsonb_build_array(r.template_id),
        'templateNames', jsonb_build_array(r.template_name)))
  )),
  'Fold Health', 'Fold Health'
FROM rules r CROSS JOIN programs p
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status,
      graph = EXCLUDED.graph, updated_by = EXCLUDED.updated_by, updated_at = now();

-- The original rule: active, last 180 days, same programs.
UPDATE automations
   SET status = 'active',
       name = 'Uncontrolled diabetes → Diabetes Intensive Monitoring',
       graph = jsonb_set(
                 jsonb_set(
                   jsonb_set(graph, '{nodes,0,config,programCodes}', '["HICM", "CMP", "DM", "SNP", "CCM"]'::jsonb),
                   '{nodes,1,config,criteria,1,withinDays}', '180'::jsonb),
                 '{nodes,2,config,templateNames}', (SELECT jsonb_build_array(name) FROM care_plan_templates WHERE id = '50dcf55e-ffc1-52ed-887a-b861588cbf66')),
       updated_at = now()
 WHERE id = '5936f78f-3c66-45b7-9662-28fce4d9fe0c'
   AND graph #>> '{nodes,0,type}' = 'careProgramEnrolled'
   AND graph #>> '{nodes,1,type}' = 'clinicalCriteria'
   AND graph #>> '{nodes,2,type}' = 'attachCarePlan';
