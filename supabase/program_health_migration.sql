-- Program health for the supervisor "Team programs" card on Home: per care
-- program, how many active members there are and how many need attention.
-- A member needs attention when any of these hold:
--   care plan gap     enrolled with no plan, a never-signed draft, or unsigned
--                     changes untouched for 7+ days
--   overdue outreach  the worklist's next action due date has passed (SNP,
--                     CCM, CMP), or the last 3 outreach attempts all failed
--   overdue task      a program task marked missed or past its due date
--   review gap        plan signed 30+ days ago, no finished call review since
-- p_codes: the programs the user supervises, or NULL for all (admins).
-- Computed in one call so Home makes a single request (no polling, no
-- shipping every row to the browser). Reads respect RLS (security invoker).

CREATE OR REPLACE FUNCTION public.program_health(p_codes text[])
RETURNS TABLE (
  program_code text,
  active_members int,
  attention_members int,
  care_plan_gaps int,
  overdue_outreach int,
  overdue_tasks int,
  review_gaps int
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
WITH codes AS (
  -- NULL means every program with enrollments (admins see all of them).
  SELECT DISTINCT unnest(p_codes) AS code WHERE p_codes IS NOT NULL
  UNION
  SELECT DISTINCT code FROM public.patient_care_programs WHERE p_codes IS NULL AND code IS NOT NULL
),
prog AS (
  SELECT pcp.id, pcp.patient_id, pcp.code, pcp.status
  FROM public.patient_care_programs pcp
  WHERE pcp.code IN (SELECT code FROM codes)
    AND coalesce(pcp.status, '') !~* '^(closed|completed|declined|disenrolled)'
),
next_due AS (
  SELECT 'SNP'::text AS code, patient_id, next_action_due FROM public.snp_worklist_members
  UNION ALL SELECT 'CCM', patient_id, next_action_due FROM public.ccm_worklist_members
  UNION ALL SELECT 'CMP', patient_id, next_action_due FROM public.cmp_members
),
flags AS (
  SELECT
    prog.code,
    prog.patient_id,
    -- Enrolled members need a signed plan; unsigned changes left for a week count too.
    (prog.status IN ('Enrolled', 'Engaged') AND (
      pl.id IS NULL
      OR pl.signed_at IS NULL
      OR (pl.updated_at > pl.signed_at + interval '1 minute' AND pl.updated_at < now() - interval '7 days')
    )) AS care_plan_gap,
    (
      EXISTS (
        SELECT 1 FROM next_due nd
        WHERE nd.code = prog.code AND nd.patient_id = prog.patient_id
          AND nd.next_action_due ~ '^\d{2}/\d{2}/\d{4}$'
          AND to_date(nd.next_action_due, 'MM/DD/YYYY') < current_date
      )
      OR EXISTS (
        -- Unreachable: the last three outreach attempts all failed.
        SELECT 1 FROM public.patients pt
        WHERE pt.member_id = prog.patient_id
          AND jsonb_array_length(coalesce(pt.attempts, '[]'::jsonb)) >= 3
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(pt.attempts) WITH ORDINALITY a(att, n)
            WHERE a.n > jsonb_array_length(pt.attempts) - 3
              AND coalesce(a.att->>'outcome', '') !~* '^(no answer|line busy|busy|wrong number|voicemail|failed|not reached)'
          )
      )
    ) AS overdue_outreach,
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.program_code = prog.code AND t.patient_id = prog.patient_id
        AND t.completed_at IS NULL
        AND coalesce(lower(t.status), '') NOT IN ('completed', 'done', 'closed', 'cancelled')
        AND (
          lower(coalesce(t.status, '')) = 'missed' OR t.due_missed IS TRUE
          OR (t.due_date ~ '^\d{2}[/-]\d{2}[/-]\d{4}$' AND to_date(replace(t.due_date, '-', '/'), 'MM/DD/YYYY') < current_date)
        )
    ) AS overdue_tasks,
    -- Signed over 30 days ago and not reviewed with the patient since.
    (pl.signed_at IS NOT NULL AND pl.signed_at < now() - interval '30 days' AND NOT EXISTS (
      SELECT 1 FROM public.care_plan_call_reviews r
      WHERE r.plan_id = pl.id AND r.finished_at > now() - interval '30 days'
    )) AS review_gap
  FROM prog
  LEFT JOIN public.patient_care_plans pl ON pl.program_id = prog.id AND pl.patient_id = prog.patient_id
)
SELECT
  codes.code AS program_code,
  count(DISTINCT f.patient_id)::int AS active_members,
  count(DISTINCT f.patient_id) FILTER (WHERE f.care_plan_gap OR f.overdue_outreach OR f.overdue_tasks OR f.review_gap)::int AS attention_members,
  count(DISTINCT f.patient_id) FILTER (WHERE f.care_plan_gap)::int AS care_plan_gaps,
  count(DISTINCT f.patient_id) FILTER (WHERE f.overdue_outreach)::int AS overdue_outreach,
  count(DISTINCT f.patient_id) FILTER (WHERE f.overdue_tasks)::int AS overdue_tasks,
  count(DISTINCT f.patient_id) FILTER (WHERE f.review_gap)::int AS review_gaps
FROM codes
LEFT JOIN flags f ON f.code = codes.code
GROUP BY codes.code
$$;

REVOKE ALL ON FUNCTION public.program_health(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_health(text[]) TO authenticated;
