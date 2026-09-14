-- Rebuild Annette Brave's (patient 11089) care plans as a realistic, curated
-- multi-program set so the Comprehensive (consolidated) Care Plan aggregates
-- Goals / Interventions / Barriers from several distinct programs.
--
-- The prior SNP plan had been bloated during testing (43 goals / 72
-- interventions / 80 barriers, 6 templates). This resets Annette's care-plan
-- data and re-applies one condition-appropriate template per program, exactly
-- reproducing the app's Apply-Templates logic (applyTemplateToPlan): goals come
-- from care_plan_templates.goals -> care_plan_goals; interventions and barriers
-- (and their goal links) are derived from care_plan_interventions rows keyed by
-- title, where kind='barrier' rows are barriers and the rest interventions.
--
-- Program -> template (each a distinct condition so the consolidated view is
-- varied and clinically coherent for a complex patient):
--   SNP    -> SNP Diabetes & Hypertension Care Plan   (Diabetes + Hypertension)
--   CCM    -> Complex Care Management                 (Multiple chronic conditions)
--   DM     -> COPD Management                         (COPD)
--   WLCP   -> Weight Management                       (Obesity / metabolic risk)
--   TOC IP -> Transitions of Care (TOC)              (Care transition)
-- AWV and CMP are intentionally left without a plan (realistic: not every
-- enrolled program carries a chronic care plan). Idempotent-ish: it snapshots,
-- fully resets Annette's plans, then rebuilds.

BEGIN;

-- 1. Snapshot everything this touches, so the reset is reversible. IF NOT
-- EXISTS so a re-run preserves the ORIGINAL pre-reset snapshot rather than
-- overwriting it with already-rebuilt data.
CREATE SCHEMA IF NOT EXISTS annette_bak;
CREATE TABLE IF NOT EXISTS annette_bak.plans AS SELECT * FROM public.patient_care_plans WHERE patient_id = '11089';
CREATE TABLE IF NOT EXISTS annette_bak.goals AS
  SELECT g.* FROM public.patient_care_plan_goals g JOIN public.patient_care_plans p ON p.id = g.plan_id WHERE p.patient_id = '11089';
CREATE TABLE IF NOT EXISTS annette_bak.intvs AS
  SELECT i.* FROM public.patient_care_plan_interventions i JOIN public.patient_care_plans p ON p.id = i.plan_id WHERE p.patient_id = '11089';
CREATE TABLE IF NOT EXISTS annette_bak.barriers AS
  SELECT b.* FROM public.patient_care_plan_barriers b JOIN public.patient_care_plans p ON p.id = b.plan_id WHERE p.patient_id = '11089';
CREATE TABLE IF NOT EXISTS annette_bak.barrier_goals AS
  SELECT j.* FROM public.patient_care_plan_barrier_goals j
  JOIN public.patient_care_plan_barriers b ON b.id = j.barrier_id
  JOIN public.patient_care_plans p ON p.id = b.plan_id WHERE p.patient_id = '11089';

-- 2. Clean slate: drop Annette's GIB then her plans (children first).
DELETE FROM public.patient_care_plan_barrier_goals j
  USING public.patient_care_plan_barriers b JOIN public.patient_care_plans p ON p.id = b.plan_id
  WHERE j.barrier_id = b.id AND p.patient_id = '11089';
DELETE FROM public.patient_care_plan_interventions i
  USING public.patient_care_plans p WHERE i.plan_id = p.id AND p.patient_id = '11089';
DELETE FROM public.patient_care_plan_barriers b
  USING public.patient_care_plans p WHERE b.plan_id = p.id AND p.patient_id = '11089';
DELETE FROM public.patient_care_plan_goals g
  USING public.patient_care_plans p WHERE g.plan_id = p.id AND p.patient_id = '11089';
DELETE FROM public.patient_care_plans WHERE patient_id = '11089';

-- 3. Apply function: reproduces applyTemplateToPlan for one (patient, program, template).
CREATE OR REPLACE FUNCTION pg_temp.apply_tpl(p_patient text, p_code text, p_tpl text) RETURNS void AS $fn$
DECLARE
  v_prog text;  -- patient_care_programs.id / patient_care_plans.program_id are text
  v_tpl  public.care_plan_templates%rowtype;
  v_plan uuid;
  v_goal jsonb;
  v_lib  public.care_plan_goals%rowtype;
  v_intv jsonb;
  v_bar  jsonb;
  v_barid uuid;
  v_gord int := 0;
  v_iord int := 0;
  v_bord int := 0;
BEGIN
  SELECT id INTO v_prog FROM public.patient_care_programs WHERE patient_id = p_patient AND code = p_code LIMIT 1;
  IF v_prog IS NULL THEN RAISE NOTICE 'skip: no program % for %', p_code, p_patient; RETURN; END IF;
  SELECT * INTO v_tpl FROM public.care_plan_templates WHERE name = p_tpl LIMIT 1;
  IF v_tpl.id IS NULL THEN RAISE NOTICE 'skip: no template %', p_tpl; RETURN; END IF;

  -- One plan per program (UNIQUE patient_id, program_id): create it on the
  -- first template, then merge later templates' ids + conditions into it so a
  -- program can carry several templates, like the app's Apply flow.
  SELECT id INTO v_plan FROM public.patient_care_plans WHERE patient_id = p_patient AND program_id = v_prog LIMIT 1;
  IF v_plan IS NULL THEN
    INSERT INTO public.patient_care_plans
      (patient_id, program_id, program_code, conditions, condition_total, applied_template_ids, created_by, created_at, updated_at)
    VALUES
      (p_patient, v_prog, p_code, COALESCE(v_tpl.conditions, '{}'),
       COALESCE(array_length(v_tpl.conditions, 1), 0), ARRAY[v_tpl.id], 'Care Team', now(), now())
    RETURNING id INTO v_plan;
  ELSE
    UPDATE public.patient_care_plans SET
      applied_template_ids = (SELECT array_agg(DISTINCT x) FROM unnest(applied_template_ids || v_tpl.id) x),
      conditions = (SELECT array_agg(DISTINCT c) FROM unnest(conditions || COALESCE(v_tpl.conditions, '{}')) c),
      updated_at = now()
    WHERE id = v_plan;
    UPDATE public.patient_care_plans SET condition_total = COALESCE(array_length(conditions, 1), 0) WHERE id = v_plan;
  END IF;

  -- Goals: from template.goals, resolving the library goal for full fields.
  FOR v_goal IN SELECT jsonb_array_elements(COALESCE(v_tpl.goals, '[]'::jsonb)) LOOP
    SELECT * INTO v_lib FROM public.care_plan_goals WHERE id = NULLIF(v_goal->>'id','')::uuid;
    IF EXISTS (SELECT 1 FROM public.patient_care_plan_goals
               WHERE plan_id = v_plan AND lower(trim(title)) = lower(trim(COALESCE(v_lib.title, v_goal->>'title')))) THEN CONTINUE; END IF;
    v_gord := v_gord + 1;
    INSERT INTO public.patient_care_plan_goals
      (plan_id, title, subtitle, icon, priority, category, measure, conditions, comparator,
       target_value, target_value_2, custom_unit, set_target, duration, duration_unit, frequency, target_date,
       status, progress, sort_order, created_at, updated_at)
    VALUES
      (v_plan, COALESCE(v_lib.title, v_goal->>'title'), COALESCE(v_lib.description, v_goal->>'subtitle', ''),
       'solar:flag-linear', COALESCE(v_lib.priority, v_goal->>'priority', 'medium'),
       COALESCE(v_lib.category, v_goal->>'category', ''), COALESCE(v_lib.measure, ''),
       COALESCE(v_lib.conditions, '{}'), COALESCE(v_lib.comparator, '='),
       COALESCE(v_lib.target_value, ''), COALESCE(v_lib.target_value_2, ''), COALESCE(v_lib.custom_unit, ''),
       COALESCE(v_lib.set_target, true), COALESCE(v_lib.duration, ''), COALESCE(v_lib.duration_unit, ''),
       COALESCE(v_lib.frequency, ''), COALESCE(v_lib.target_date, ''),
       'Not Started', 0, v_gord, now(), now());
  END LOOP;

  -- Interventions: from template.interventions, linked to the first owning goal
  -- (a non-barrier care_plan_interventions row with the same title on a library
  -- goal that is now on this plan).
  FOR v_intv IN SELECT jsonb_array_elements(COALESCE(v_tpl.interventions, '[]'::jsonb)) LOOP
    IF EXISTS (SELECT 1 FROM public.patient_care_plan_interventions
               WHERE plan_id = v_plan AND lower(trim(title)) = lower(trim(v_intv->>'title'))) THEN CONTINUE; END IF;
    v_iord := v_iord + 1;
    INSERT INTO public.patient_care_plan_interventions
      (plan_id, goal_id, kind, title, icon, config, status, assignee_name, assignee_initials, priority, sort_order, created_at, updated_at)
    VALUES
      (v_plan,
       (SELECT pg.id FROM public.care_plan_interventions ci
          JOIN public.care_plan_goals lg ON lg.id = ci.goal_id
          JOIN public.patient_care_plan_goals pg ON pg.plan_id = v_plan AND lower(trim(pg.title)) = lower(trim(lg.title))
         WHERE lower(trim(ci.title)) = lower(trim(v_intv->>'title')) AND COALESCE(ci.kind,'') <> 'barrier'
         ORDER BY ci.created_at LIMIT 1),
       COALESCE(v_intv->>'kind', 'internal-task'), v_intv->>'title', 'solar:clipboard-list-linear',
       COALESCE(v_intv->'config', '{}'::jsonb), 'Not Started', 'Unassigned', '', 'medium', v_iord, now(), now());
  END LOOP;

  -- Barriers: from template.barriers, linked to every owning goal (a
  -- kind='barrier' care_plan_interventions row with the same title).
  FOR v_bar IN SELECT jsonb_array_elements(COALESCE(v_tpl.barriers, '[]'::jsonb)) LOOP
    IF EXISTS (SELECT 1 FROM public.patient_care_plan_barriers
               WHERE plan_id = v_plan AND lower(trim(title)) = lower(trim(v_bar->>'title'))) THEN CONTINUE; END IF;
    v_bord := v_bord + 1;
    INSERT INTO public.patient_care_plan_barriers
      (plan_id, title, description, status, priority, sort_order, created_at, updated_at)
    VALUES
      (v_plan, v_bar->>'title', COALESCE(v_bar->>'description', ''), 'Not Started',
       COALESCE(v_bar->>'priority', 'medium'), v_bord, now(), now())
    RETURNING id INTO v_barid;

    INSERT INTO public.patient_care_plan_barrier_goals (barrier_id, goal_id, created_at)
    SELECT DISTINCT v_barid, pg.id, now()
    FROM public.care_plan_interventions ci
    JOIN public.care_plan_goals lg ON lg.id = ci.goal_id
    JOIN public.patient_care_plan_goals pg ON pg.plan_id = v_plan AND lower(trim(pg.title)) = lower(trim(lg.title))
    WHERE lower(trim(ci.title)) = lower(trim(v_bar->>'title')) AND ci.kind = 'barrier';

    -- Legacy single goal_id (mapPatientCarePlanBarrierRow's read fallback): the
    -- first linked goal, if any.
    UPDATE public.patient_care_plan_barriers b
      SET goal_id = (SELECT j.goal_id FROM public.patient_care_plan_barrier_goals j WHERE j.barrier_id = v_barid ORDER BY j.created_at LIMIT 1)
      WHERE b.id = v_barid;
  END LOOP;
END;
$fn$ LANGUAGE plpgsql;

-- 4. Apply the curated, condition-appropriate mapping. SNP (her flagship
-- dual-eligible plan) carries her two primary conditions via the standard,
-- fully-linked Diabetes + Hypertension templates rather than the legacy
-- "SNP Diabetes & Hypertension" template, whose library goals have no
-- intervention/barrier links (so it would add them unlinked).
SELECT pg_temp.apply_tpl('11089', 'SNP',    'Diabetes Management');
SELECT pg_temp.apply_tpl('11089', 'SNP',    'Hypertension Management');
SELECT pg_temp.apply_tpl('11089', 'CCM',    'Complex Care Management');
SELECT pg_temp.apply_tpl('11089', 'DM',     'COPD Management');
SELECT pg_temp.apply_tpl('11089', 'WLCP',   'Weight Management');
SELECT pg_temp.apply_tpl('11089', 'TOC IP', 'Transitions of Care (TOC)');

COMMIT;
