-- Care plan template optimization suggestions
--
-- A nightly analysis of how Care Plan Library templates are used and how
-- they turn out, written as suggestions a supervisor accepts or dismisses in
-- Settings > Care Plan Library > Suggestions. Four kinds, all from real runs
-- (patient_care_plan_template_instances) and plan goals:
--
--   retire          published 90+ days, applied to at most one plan in 180
--   abandon         30%+ of recent runs removed within 14 days of being added
--                   (the template was taken back off while building the plan)
--   goal_attainment under 40% of its goals Met/Resolved on runs 90+ days old
--   split           plans keep under 60% of its goals on average, or it spans
--                   3+ conditions with 10+ goals
--   merge           two templates run together on 60%+ of the smaller one's
--                   plans, or share 60%+ of their goal titles
--
-- Each kind needs a minimum sample so a template with two runs is never
-- judged on them. The SQL writes a plain rule-based rationale; the app may
-- add an AI-written one (ai_rationale) through /api/template-optimization.
--
-- Accepting a retire archives the template, so `archived` joins the status
-- set. Archived templates leave the Plan Template tab and Apply Templates but
-- stay on plans they were already applied to.
--
-- A dismissed or accepted suggestion is not raised again for 90 days. An open
-- one whose signal goes away is marked resolved.
--
-- RLS: on, open to authenticated, closed to anon (RLS_POSTURE.md). Rows are
-- written by the SECURITY DEFINER analyzer; the app only updates decisions
-- and the AI rationale.

-- ── Template status: add archived ──────────────────────────────────────────
ALTER TABLE public.care_plan_templates
  DROP CONSTRAINT IF EXISTS care_plan_templates_status_check;
ALTER TABLE public.care_plan_templates
  ADD CONSTRAINT care_plan_templates_status_check
  CHECK (status IN ('draft', 'published', 'archived'));

-- ── Suggestions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_plan_template_suggestions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         uuid NOT NULL REFERENCES public.care_plan_templates(id) ON DELETE CASCADE,
  -- The other template of a merge pair; null for every other kind.
  related_template_id uuid REFERENCES public.care_plan_templates(id) ON DELETE CASCADE,
  kind                text NOT NULL CHECK (kind IN ('retire', 'abandon', 'goal_attainment', 'split', 'merge')),
  metrics             jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale           text NOT NULL DEFAULT '',
  ai_rationale        text,
  ai_generated_at     timestamptz,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed', 'resolved')),
  decided_by          text,
  decided_at          timestamptz,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- One open suggestion per template, kind and merge partner.
CREATE UNIQUE INDEX IF NOT EXISTS care_plan_template_suggestions_open_key
  ON public.care_plan_template_suggestions
  (template_id, kind, coalesce(related_template_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS care_plan_template_suggestions_status_idx
  ON public.care_plan_template_suggestions (status, detected_at DESC);

ALTER TABLE public.care_plan_template_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read care_plan_template_suggestions" ON public.care_plan_template_suggestions;
CREATE POLICY "Staff read care_plan_template_suggestions"
  ON public.care_plan_template_suggestions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff decide care_plan_template_suggestions" ON public.care_plan_template_suggestions;
CREATE POLICY "Staff decide care_plan_template_suggestions"
  ON public.care_plan_template_suggestions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── Analyzer ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_care_plan_template_suggestions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  DROP TABLE IF EXISTS _found;
  CREATE TEMP TABLE _found AS
  WITH tpl AS (
    SELECT t.id, t.name, t.created_at, t.conditions,
           jsonb_array_length(coalesce(t.goals, '[]'::jsonb)) AS goal_count
      FROM care_plan_templates t
     WHERE t.status = 'published' AND coalesce(t.scope, 'org') = 'org'
  ),
  runs AS (
    SELECT i.template_id, i.plan_id, i.status, i.auto_closed, i.ended_at,
           coalesce(i.started_at, i.created_at) AS began
      FROM patient_care_plan_template_instances i
      JOIN tpl ON tpl.id = i.template_id
  ),
  -- A template goal's title, from the library goal it points at when it does.
  tgoals AS (
    SELECT DISTINCT t.id AS template_id, lower(trim(coalesce(lg.title, g->>'title'))) AS title
      FROM care_plan_templates t
      JOIN tpl ON tpl.id = t.id
     CROSS JOIN LATERAL jsonb_array_elements(coalesce(t.goals, '[]'::jsonb)) g
      LEFT JOIN care_plan_goals lg ON lg.id::text = g->>'id'
     WHERE coalesce(lg.title, g->>'title', '') <> ''
  ),
  -- Plans that used each template in the last 180 days, by run or (for plans
  -- from before runs were recorded) by applied_template_ids.
  recent_use AS (
    SELECT template_id, plan_id, began FROM runs WHERE began >= now() - interval '180 days'
    UNION
    SELECT tid, p.id, p.updated_at
      FROM patient_care_plans p, unnest(p.applied_template_ids) tid
     WHERE p.updated_at >= now() - interval '180 days'
  ),
  retire AS (
    SELECT tpl.id AS template_id, NULL::uuid AS related_template_id, 'retire'::text AS kind,
           jsonb_build_object(
             'plans_180d', count(DISTINCT u.plan_id),
             'last_used_at', max(u.began),
             'age_days', extract(day FROM now() - tpl.created_at)::int
           ) AS metrics,
           format('Applied to %s plan%s in the last 180 days, %s days after it was published.',
                  count(DISTINCT u.plan_id), CASE WHEN count(DISTINCT u.plan_id) = 1 THEN '' ELSE 's' END,
                  extract(day FROM now() - tpl.created_at)::int) AS rationale
      FROM tpl LEFT JOIN recent_use u ON u.template_id = tpl.id
     WHERE tpl.created_at <= now() - interval '90 days'
     GROUP BY tpl.id, tpl.created_at
    HAVING count(DISTINCT u.plan_id) <= 1
  ),
  abandon AS (
    SELECT template_id, NULL::uuid, 'abandon'::text,
           jsonb_build_object('runs', count(*), 'abandoned', sum(a), 'rate', round(sum(a)::numeric / count(*), 2)),
           format('Removed within 14 days of being added on %s of %s plans (%s%%).',
                  sum(a), count(*), round(100 * sum(a)::numeric / count(*)))
      FROM (
        SELECT template_id,
               CASE WHEN status = 'closed' AND NOT auto_closed AND ended_at IS NOT NULL
                         AND ended_at - began <= interval '14 days' THEN 1 ELSE 0 END AS a
          FROM runs
         WHERE began >= now() - interval '180 days' AND began <= now() - interval '14 days'
      ) r
     GROUP BY template_id
    HAVING count(*) >= 5 AND sum(a)::numeric / count(*) >= 0.3
  ),
  -- Plan goals that came from a template, matched by title as the app does.
  run_goals AS (
    SELECT r.template_id, r.plan_id, g.status
      FROM runs r
      JOIN patient_care_plan_goals g ON g.plan_id = r.plan_id
      JOIN tgoals tg ON tg.template_id = r.template_id AND tg.title = lower(trim(g.title))
  ),
  attainment AS (
    SELECT template_id, NULL::uuid, 'goal_attainment'::text,
           jsonb_build_object('runs', count(DISTINCT plan_id), 'goals', count(*), 'met', sum(met),
                              'rate', round(sum(met)::numeric / count(*), 2)),
           format('%s of %s goals Met or Resolved across %s plans that have run it for 90+ days (%s%%).',
                  sum(met), count(*), count(DISTINCT plan_id), round(100 * sum(met)::numeric / count(*)))
      FROM (
        SELECT rg.template_id, rg.plan_id,
               CASE WHEN rg.status IN ('Met', 'Resolved') THEN 1 ELSE 0 END AS met
          FROM run_goals rg
         WHERE rg.status NOT IN ('Discontinued', 'Not Applicable')
           AND EXISTS (SELECT 1 FROM runs r WHERE r.template_id = rg.template_id AND r.plan_id = rg.plan_id
                         AND r.began <= now() - interval '90 days')
      ) x
     GROUP BY template_id
    HAVING count(DISTINCT plan_id) >= 3 AND count(*) >= 10 AND sum(met)::numeric / count(*) < 0.4
  ),
  -- Share of the template's goals each plan kept, after authoring settled.
  coverage AS (
    SELECT r.template_id, r.plan_id,
           (SELECT count(DISTINCT lower(trim(g.title)))
              FROM patient_care_plan_goals g
              JOIN tgoals tg ON tg.template_id = r.template_id AND tg.title = lower(trim(g.title))
             WHERE g.plan_id = r.plan_id)::numeric
           / nullif((SELECT count(*) FROM tgoals tg WHERE tg.template_id = r.template_id), 0) AS kept
      FROM runs r
     WHERE (r.status <> 'closed' OR r.auto_closed)
       AND r.began <= now() - interval '14 days'
  ),
  split AS (
    SELECT tpl.id, NULL::uuid, 'split'::text,
           jsonb_build_object('runs', c.runs, 'avg_kept', round(c.avg_kept, 2), 'goals', tpl.goal_count,
                              'conditions', coalesce(array_length(tpl.conditions, 1), 0)),
           CASE WHEN c.runs >= 5 AND c.avg_kept < 0.6
                THEN format('Plans keep %s%% of its %s goals on average across %s runs, so care teams use part of it.',
                            round(100 * c.avg_kept), tpl.goal_count, c.runs)
                ELSE format('Covers %s conditions with %s goals in one template.',
                            array_length(tpl.conditions, 1), tpl.goal_count) END
      FROM tpl
      LEFT JOIN (SELECT template_id, count(*) AS runs, avg(kept) AS avg_kept
                   FROM coverage WHERE kept IS NOT NULL GROUP BY template_id) c ON c.template_id = tpl.id
     WHERE tpl.goal_count >= 4
       AND ((c.runs >= 5 AND c.avg_kept < 0.6)
            OR (coalesce(array_length(tpl.conditions, 1), 0) >= 3 AND tpl.goal_count >= 10))
  ),
  plans_per AS (
    SELECT template_id, count(DISTINCT plan_id) AS plans FROM runs GROUP BY template_id
  ),
  co_applied AS (
    SELECT a.template_id AS a_id, b.template_id AS b_id, count(DISTINCT a.plan_id) AS together
      FROM runs a
      JOIN runs b ON b.plan_id = a.plan_id AND b.template_id > a.template_id
                 AND a.began <= coalesce(b.ended_at, now()) AND b.began <= coalesce(a.ended_at, now())
     GROUP BY 1, 2
  ),
  overlap AS (
    SELECT a.template_id AS a_id, b.template_id AS b_id,
           count(*) AS shared
      FROM tgoals a
      JOIN tgoals b ON b.title = a.title AND b.template_id > a.template_id
     GROUP BY 1, 2
  ),
  goal_n AS (SELECT template_id, count(*) AS n FROM tgoals GROUP BY template_id),
  merge_pairs AS (
    SELECT coalesce(c.a_id, o.a_id) AS a_id, coalesce(c.b_id, o.b_id) AS b_id,
           coalesce(c.together, 0) AS together, coalesce(o.shared, 0) AS shared
      FROM co_applied c FULL JOIN overlap o ON o.a_id = c.a_id AND o.b_id = c.b_id
  ),
  merge AS (
    SELECT m.a_id, m.b_id, 'merge'::text,
           jsonb_build_object('together', m.together, 'smaller_plans', least(pa.plans, pb.plans),
                              'shared_goals', m.shared,
                              'goal_overlap', round(m.shared::numeric / nullif(ga.n + gb.n - m.shared, 0), 2)),
           CASE WHEN m.together >= 5 AND m.together::numeric / least(pa.plans, pb.plans) >= 0.6
                THEN format('Applied together on %s plans, %s%% of the plans using the less common one.',
                            m.together, round(100 * m.together::numeric / least(pa.plans, pb.plans)))
                ELSE format('Share %s goals (%s%% of their combined goals).',
                            m.shared, round(100 * m.shared::numeric / (ga.n + gb.n - m.shared))) END
      FROM merge_pairs m
      JOIN tpl ta ON ta.id = m.a_id
      JOIN tpl tb ON tb.id = m.b_id
      LEFT JOIN plans_per pa ON pa.template_id = m.a_id
      LEFT JOIN plans_per pb ON pb.template_id = m.b_id
      LEFT JOIN goal_n ga ON ga.template_id = m.a_id
      LEFT JOIN goal_n gb ON gb.template_id = m.b_id
     WHERE (m.together >= 5 AND m.together::numeric / nullif(least(pa.plans, pb.plans), 0) >= 0.6)
        OR (ga.n >= 3 AND gb.n >= 3 AND m.shared::numeric / nullif(ga.n + gb.n - m.shared, 0) >= 0.6)
  )
  SELECT * FROM retire
  UNION ALL SELECT * FROM abandon
  UNION ALL SELECT * FROM attainment
  UNION ALL SELECT * FROM split
  UNION ALL SELECT * FROM merge;

  -- Signals that went away resolve their open suggestion.
  UPDATE care_plan_template_suggestions s
     SET status = 'resolved', updated_at = now()
   WHERE s.status = 'open'
     AND NOT EXISTS (
       SELECT 1 FROM _found f
        WHERE f.template_id = s.template_id AND f.kind = s.kind
          AND f.related_template_id IS NOT DISTINCT FROM s.related_template_id);

  INSERT INTO care_plan_template_suggestions (template_id, related_template_id, kind, metrics, rationale)
  SELECT f.template_id, f.related_template_id, f.kind, f.metrics, f.rationale
    FROM _found f
   WHERE NOT EXISTS (
     SELECT 1 FROM care_plan_template_suggestions s
      WHERE s.template_id = f.template_id AND s.kind = f.kind
        AND s.related_template_id IS NOT DISTINCT FROM f.related_template_id
        AND s.status IN ('accepted', 'dismissed') AND s.decided_at > now() - interval '90 days')
  ON CONFLICT (template_id, kind, coalesce(related_template_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE status = 'open'
  DO UPDATE SET
    metrics = EXCLUDED.metrics,
    rationale = EXCLUDED.rationale,
    -- New numbers make the AI wording stale.
    ai_rationale = CASE WHEN care_plan_template_suggestions.metrics = EXCLUDED.metrics
                        THEN care_plan_template_suggestions.ai_rationale END,
    updated_at = now();

  SELECT count(*) INTO n FROM care_plan_template_suggestions WHERE status = 'open';
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_care_plan_template_suggestions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_care_plan_template_suggestions() TO authenticated;

-- ── Nightly schedule (pg_cron, available on the free plan) ──────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.unschedule('care-plan-template-suggestions')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'care-plan-template-suggestions');
SELECT cron.schedule('care-plan-template-suggestions', '15 7 * * *',
                     'SELECT public.refresh_care_plan_template_suggestions()');

SELECT public.refresh_care_plan_template_suggestions();
