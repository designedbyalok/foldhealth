-- Reusable Care Plan Library template built from the curated SNP sample plan
-- (patient snpw-001, T2DM + Hypertension). Captures the plan's goals
-- (title/subtitle/category/priority), interventions (kind/title/duration) and
-- barriers (title/description) as care_plan_templates jsonb, so the plan can be
-- applied to other patients from the Apply Templates picker.
-- Idempotent: re-running replaces the template of the same name.

delete from care_plan_templates where name = 'SNP Diabetes & Hypertension Care Plan';

insert into care_plan_templates (id, name, conditions, goals, interventions, barriers, created_by, updated_by)
select
  gen_random_uuid(),
  'SNP Diabetes & Hypertension Care Plan',
  array['Diabetes', 'Hypertension'],
  (select jsonb_agg(jsonb_build_object(
      'id', g.id, 'title', g.title, 'subtitle', g.subtitle,
      'category', g.category, 'priority', g.priority
    ) order by g.sort_order)
   from patient_care_plan_goals g where g.plan_id = '8d30c3c8-519a-4167-955f-d264f4564937'),
  (select jsonb_agg(jsonb_build_object(
      'id', i.id, 'kind', i.kind, 'title', i.title, 'duration', i.duration
    ) order by i.sort_order)
   from patient_care_plan_interventions i where i.plan_id = '8d30c3c8-519a-4167-955f-d264f4564937'),
  (select jsonb_agg(jsonb_build_object(
      'id', b.id, 'title', b.title, 'description', coalesce(b.description, '')
    ) order by b.sort_order)
   from patient_care_plan_barriers b where b.plan_id = '8d30c3c8-519a-4167-955f-d264f4564937'),
  'Alok Kumar',
  'Alok Kumar';
