-- Episodes as their own program, pause rules, nightly close
--
-- Builds on care_plan_episodic_templates_migration.sql.
--
--   * episode_program_code: the program an episodic template runs as
--     (TOC IP, TOC ED, HH). Applying it enrolls the patient in that program
--     with a care plan of its own instead of adding goals to the plan it was
--     applied from; the enrollment completes when the episode ends.
--   * episode_supersedes: which programs the episode pauses by default
--     (program codes; empty pauses every other ongoing plan). Whoever applies
--     it can still change the picks for that patient. Other episodes never
--     pause.
--   * close_due_care_plan_episodes(), run nightly by pg_cron: closes every
--     episode past its last day the way End Episode does in the app (its
--     goals, interventions and barriers move to the plan's history unless
--     another applied template covers them, the run records how many were
--     met, the template comes off the plan, the plans it paused resume, its
--     program completes) and writes care_plan_audit rows as "System".
--     Opening the plan still closes a due episode too, so nothing waits on
--     the job.
--   * Library: Transitions of Care (TOC) runs as TOC IP. Two episodic
--     templates are added from entries of existing templates (no new clinical
--     content): "Transitions of Care - ED (TOC ED)" (14 days, from ER Visit
--     Reduction) and "Home Health Episode" (until closed, from ADL Support
--     Plan and Home Safety Plan).
--
-- "Past its last day" is judged in America/Los_Angeles, and the job runs at
-- 09:00 UTC (1 or 2 AM Pacific).
--
-- Additive and idempotent. No new table, so RLS is unchanged.

-- ── Templates ──────────────────────────────────────────────────────────────
ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS episode_program_code text,
  ADD COLUMN IF NOT EXISTS episode_supersedes   text[] NOT NULL DEFAULT '{}';

UPDATE public.care_plan_templates
   SET episode_program_code = 'TOC IP'
 WHERE name = 'Transitions of Care (TOC)' AND episodic AND episode_program_code IS NULL;

-- ── New episodic templates, from existing templates' entries ───────────────
WITH src AS (
  SELECT goals, interventions, barriers FROM public.care_plan_templates
   WHERE name = 'ER Visit Reduction' AND status = 'published' ORDER BY created_at LIMIT 1
)
INSERT INTO public.care_plan_templates
  (name, conditions, goals, interventions, barriers, status, renewal,
   episodic, episode_days, episode_pauses_ongoing, episode_program_code, created_by, updated_by)
SELECT 'Transitions of Care - ED (TOC ED)', ARRAY['Care transition'],
       coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(src.goals) e WHERE e->>'title' IN (
         'Complete post-discharge follow-up', 'Follow post-discharge medication plan',
         'Improve recognition of warning signs', 'Establish post-discharge care coordination')), '[]'),
       coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(src.interventions) e WHERE e->>'title' IN (
         'Post-discharge outreach', 'Post-discharge appointment coordination',
         'Appointment tracking', 'Medication adherence education')), '[]'),
       coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(src.barriers) e WHERE e->>'title' IN (
         'Follow-up access issue', 'Appointment access issue')), '[]'),
       'published', 'reinstate', true, 14, true, 'TOC ED', 'System', 'System'
  FROM src
 WHERE NOT EXISTS (SELECT 1 FROM public.care_plan_templates WHERE name = 'Transitions of Care - ED (TOC ED)');

WITH entries AS (
  SELECT kind, e, row_number() OVER (PARTITION BY kind, e->>'title' ORDER BY t.name) AS dup
    FROM public.care_plan_templates t
   CROSS JOIN LATERAL (
     SELECT 'goal' AS kind, g AS e FROM jsonb_array_elements(t.goals) g
     UNION ALL SELECT 'intervention', i FROM jsonb_array_elements(t.interventions) i
     UNION ALL SELECT 'barrier', b FROM jsonb_array_elements(t.barriers) b
   ) x
   WHERE t.name IN ('ADL Support Plan', 'Home Safety Plan') AND t.status = 'published'
),
picked AS (
  SELECT kind, e FROM entries WHERE dup = 1 AND (
       (kind = 'goal' AND e->>'title' IN ('Maintain ability to perform ADLs', 'Increase independence with self-care',
          'Improve mobility', 'Maintain home safety', 'Improve fall-prevention behaviors'))
    OR (kind = 'intervention' AND e->>'title' IN ('Functional assessment', 'ADL support planning', 'Self-care coaching',
          'Home safety education', 'Home-safety follow-up', 'Fall-risk assessment'))
    OR (kind = 'barrier' AND e->>'title' IN ('Mobility limitation', 'Need for caregiver assistance', 'Fall-risk environment')))
)
INSERT INTO public.care_plan_templates
  (name, conditions, goals, interventions, barriers, status, renewal,
   episodic, episode_days, episode_pauses_ongoing, episode_program_code, created_by, updated_by)
SELECT 'Home Health Episode', ARRAY['Home health'],
       coalesce((SELECT jsonb_agg(e) FROM picked WHERE kind = 'goal'), '[]'),
       coalesce((SELECT jsonb_agg(e) FROM picked WHERE kind = 'intervention'), '[]'),
       coalesce((SELECT jsonb_agg(e) FROM picked WHERE kind = 'barrier'), '[]'),
       'published', 'reinstate', true, NULL, true, 'HH', 'System', 'System'
 WHERE EXISTS (SELECT 1 FROM picked)
   AND NOT EXISTS (SELECT 1 FROM public.care_plan_templates WHERE name = 'Home Health Episode');

-- Their version 1, as publishing in the app records it.
INSERT INTO public.care_plan_template_versions (template_id, version_number, effective_date, content, note)
SELECT t.id, 1, current_date,
       jsonb_build_object('name', t.name, 'goals', t.goals, 'interventions', t.interventions, 'barriers', t.barriers,
                          'conditions', to_jsonb(t.conditions), 'renewal', t.renewal),
       'Initial version'
  FROM public.care_plan_templates t
 WHERE t.name IN ('Transitions of Care - ED (TOC ED)', 'Home Health Episode')
   AND NOT EXISTS (SELECT 1 FROM public.care_plan_template_versions v WHERE v.template_id = t.id);
UPDATE public.care_plan_templates SET current_version_number = 1
 WHERE name IN ('Transitions of Care - ED (TOC ED)', 'Home Health Episode') AND current_version_number IS NULL;

-- ── Nightly close ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_due_care_plan_episodes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today  date := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  r      record;
  p      record;
  t      record;
  done   integer;
  total  integer;
  resumed integer;
  n      integer := 0;
BEGIN
  FOR r IN
    -- Claimed first, so a plan being opened at the same moment can't close it twice.
    UPDATE patient_care_plan_template_instances i
       SET status = 'closed', auto_closed = true, ended_at = now(), close_reason = 'episode_end'
     WHERE i.episodic AND i.status = 'active' AND i.ends_on IS NOT NULL AND i.ends_on < today
    RETURNING i.id, i.plan_id, i.template_id, i.template_name, i.ends_on, i.paused_plan_ids
  LOOP
    n := n + 1;
    SELECT * INTO p FROM patient_care_plans WHERE id = r.plan_id;
    SELECT * INTO t FROM care_plan_templates WHERE id = r.template_id;

    -- Items are the template's by title, as the app matches them; ones another
    -- applied template also covers stay on the plan.
    WITH own AS (
      SELECT 'goal' AS kind, lower(trim(coalesce(lg.title, e->>'title'))) AS title
        FROM jsonb_array_elements(coalesce(t.goals, '[]')) e
        LEFT JOIN care_plan_goals lg ON lg.id::text = e->>'id'
      UNION SELECT 'intervention', lower(trim(e->>'title')) FROM jsonb_array_elements(coalesce(t.interventions, '[]')) e
      UNION SELECT 'barrier', lower(trim(e->>'title')) FROM jsonb_array_elements(coalesce(t.barriers, '[]')) e
    ),
    shared AS (
      SELECT 'goal' AS kind, lower(trim(coalesce(lg.title, e->>'title'))) AS title
        FROM care_plan_templates o
       CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.goals, '[]')) e
        LEFT JOIN care_plan_goals lg ON lg.id::text = e->>'id'
       WHERE o.id = ANY(p.applied_template_ids) AND o.id <> r.template_id
      UNION SELECT 'intervention', lower(trim(e->>'title'))
        FROM care_plan_templates o CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.interventions, '[]')) e
       WHERE o.id = ANY(p.applied_template_ids) AND o.id <> r.template_id
      UNION SELECT 'barrier', lower(trim(e->>'title'))
        FROM care_plan_templates o CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.barriers, '[]')) e
       WHERE o.id = ANY(p.applied_template_ids) AND o.id <> r.template_id
    ),
    mine AS (SELECT kind, title FROM own EXCEPT SELECT kind, title FROM shared)
    UPDATE patient_care_plan_goals g SET retired_instance_id = r.id
     WHERE g.plan_id = r.plan_id AND g.retired_instance_id IS NULL
       AND lower(trim(g.title)) IN (SELECT title FROM mine WHERE kind = 'goal');

    WITH own AS (
      SELECT lower(trim(e->>'title')) AS title FROM jsonb_array_elements(coalesce(t.interventions, '[]')) e
      EXCEPT
      SELECT lower(trim(e->>'title')) FROM care_plan_templates o
       CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.interventions, '[]')) e
       WHERE o.id = ANY(p.applied_template_ids) AND o.id <> r.template_id
    )
    UPDATE patient_care_plan_interventions x SET retired_instance_id = r.id
     WHERE x.plan_id = r.plan_id AND x.retired_instance_id IS NULL
       AND lower(trim(x.title)) IN (SELECT title FROM own);

    -- Barriers go by title or with the goals they hang off.
    WITH own AS (
      SELECT lower(trim(e->>'title')) AS title FROM jsonb_array_elements(coalesce(t.barriers, '[]')) e
      EXCEPT
      SELECT lower(trim(e->>'title')) FROM care_plan_templates o
       CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.barriers, '[]')) e
       WHERE o.id = ANY(p.applied_template_ids) AND o.id <> r.template_id
    ),
    gone AS (SELECT id FROM patient_care_plan_goals WHERE retired_instance_id = r.id)
    UPDATE patient_care_plan_barriers b SET retired_instance_id = r.id
     WHERE b.plan_id = r.plan_id AND b.retired_instance_id IS NULL
       AND (lower(trim(b.title)) IN (SELECT title FROM own)
            OR b.goal_id IN (SELECT id FROM gone)
            OR EXISTS (SELECT 1 FROM patient_care_plan_barrier_goals bg
                        WHERE bg.barrier_id = b.id AND bg.goal_id IN (SELECT id FROM gone)));

    -- How it went: goals and interventions met, leaving out discontinued ones.
    SELECT count(*) FILTER (WHERE status IN ('Met', 'Resolved')),
           count(*) FILTER (WHERE status NOT IN ('Discontinued', 'Not Applicable'))
      INTO done, total
      FROM (SELECT status FROM patient_care_plan_goals WHERE retired_instance_id = r.id
            UNION ALL SELECT status FROM patient_care_plan_interventions WHERE retired_instance_id = r.id) x;
    UPDATE patient_care_plan_template_instances
       SET status = CASE WHEN total > 0 AND done = total THEN 'completed' ELSE 'closed' END,
           done_count = done, total_count = total
     WHERE id = r.id;

    UPDATE patient_care_plans
       SET applied_template_ids = array_remove(applied_template_ids, r.template_id), updated_at = now()
     WHERE id = r.plan_id;

    -- The plans it paused, still paused for an episode, resume.
    WITH up AS (
      UPDATE patient_care_plans
         SET status = 'active', pause_reason = NULL, pause_note = NULL, paused_on = NULL,
             resume_on = NULL, auto_resume = false, paused_by = NULL, updated_at = now()
       WHERE id = ANY(r.paused_plan_ids) AND status = 'paused' AND pause_reason = 'episode'
      RETURNING id, patient_id, program_id, program_code
    ), logged AS (
      INSERT INTO care_plan_audit (patient_id, program_id, program_code, entity_type, entity_id, action, summary, detail, actor)
      SELECT patient_id, program_id, program_code, 'plan', id::text, 'resumed',
             'Resumed automatically when the episode ended', r.template_name || ' episode ended', 'System'
        FROM up
      RETURNING 1
    )
    SELECT count(*) INTO resumed FROM logged;

    INSERT INTO care_plan_audit (patient_id, program_id, program_code, entity_type, entity_id, action, summary, detail, actor)
    VALUES (p.patient_id, p.program_id, p.program_code, 'template', r.template_id::text, 'episode_ended', r.template_name,
            concat_ws(' · ',
              'Ended on its last day (' || to_char(r.ends_on, 'Mon FMDD, YYYY') || ')',
              done || ' of ' || total || ' goals and interventions met',
              CASE WHEN resumed > 0 THEN 'Paused care plans resumed' END),
            'System');

    -- An episode that ran as its own program completes that enrollment.
    IF t.episode_program_code IS NOT NULL AND t.episode_program_code = p.program_code THEN
      UPDATE patient_care_programs
         SET status = 'Completed', status_color = 'var(--neutral-300)',
             end_date = to_char(today, 'MM/DD/YYYY'), last_updated = to_char(today, 'MM/DD/YYYY'),
             closure_reason = 'other', closure_note = 'Episode ended on its last day',
             closed_at = now(), closed_by = 'System'
       WHERE id = p.program_id AND closed_at IS NULL;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.close_due_care_plan_episodes() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.unschedule('close-due-care-plan-episodes')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close-due-care-plan-episodes');
SELECT cron.schedule('close-due-care-plan-episodes', '0 9 * * *',
                     'SELECT public.close_due_care_plan_episodes()');

NOTIFY pgrst, 'reload schema';

-- ── Verify ─────────────────────────────────────────────────────────────────
--   select name, episode_days, episode_program_code, episode_supersedes
--     from care_plan_templates where episodic;
--   select jobname, schedule, active from cron.job where jobname = 'close-due-care-plan-episodes';
--
-- ── Rollback ───────────────────────────────────────────────────────────────
--   select cron.unschedule('close-due-care-plan-episodes');
--   drop function if exists public.close_due_care_plan_episodes();
--   delete from care_plan_templates where name in ('Transitions of Care - ED (TOC ED)', 'Home Health Episode');
--   alter table care_plan_templates drop column if exists episode_supersedes, drop column if exists episode_program_code;
