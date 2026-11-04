-- Employer Impact Report: weekly grain for the time-series charts.
--
-- employer_impact_metrics holds one row per month, so a Month or Quarter
-- report drew one or three bars. This table holds the same metrics by week
-- (Monday start) for the charts whose x axis is time; Month and Quarter
-- read it, Year keeps reading months. Categorical charts, stat cards and
-- savings still fold the monthly table over the range, so their totals
-- don't change.
--
-- A week belongs to the month its Monday falls in, and the weeks of a month
-- add up to that month's row (snapshots, like active members, repeat the
-- level instead).
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.employer_impact_weekly_rollup(date, date, text, text, text);
--   DROP TABLE IF EXISTS public.employer_impact_weekly_metrics;

CREATE TABLE IF NOT EXISTS public.employer_impact_weekly_metrics (
  id                text PRIMARY KEY,       -- employer|patient_loc|visit_loc|week|metric|series|bucket
  employer_id       text NOT NULL REFERENCES public.employer_impact_employers (id) ON DELETE CASCADE,
  patient_location  text NOT NULL,
  visit_location    text NOT NULL,
  week              date NOT NULL,          -- the week's Monday
  metric            text NOT NULL,
  series            text NOT NULL,
  bucket            text NOT NULL DEFAULT '',
  value             numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS employer_impact_weekly_metrics_filter_idx
  ON public.employer_impact_weekly_metrics (week, employer_id);
ALTER TABLE public.employer_impact_weekly_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on employer_impact_weekly_metrics" ON public.employer_impact_weekly_metrics;
CREATE POLICY "Allow all on employer_impact_weekly_metrics" ON public.employer_impact_weekly_metrics
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

-- The weeks whose Monday falls in p_from's month through p_to's month,
-- combined like employer_impact_rollup. `mo` carries the week's Monday
-- ('YYYY-MM-DD') so the browser indexes both rollups the same way.
CREATE OR REPLACE FUNCTION public.employer_impact_weekly_rollup(
  p_from            date,
  p_to              date,
  p_employer        text DEFAULT NULL,
  p_location_scope  text DEFAULT 'patient',
  p_location        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'm', metric, 's', series, 'b', bucket, 'mo', to_char(week, 'YYYY-MM-DD'), 'v', v
         )), '[]'::jsonb)
  FROM (
    SELECT metric, series, bucket, week,
           CASE WHEN series = 'max' THEN MAX(value)
                WHEN series = 'min' THEN MIN(value)
                ELSE SUM(value) END AS v
    FROM public.employer_impact_weekly_metrics
    WHERE week >= date_trunc('month', p_from)::date
      AND week < (date_trunc('month', p_to) + interval '1 month')::date
      AND (p_employer IS NULL OR employer_id = p_employer)
      AND (p_location IS NULL OR
           (CASE WHEN p_location_scope = 'visit' THEN visit_location ELSE patient_location END) = p_location)
    GROUP BY metric, series, bucket, week
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.employer_impact_weekly_rollup(date, date, text, text, text) TO authenticated;
