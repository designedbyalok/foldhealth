-- Scheduled care plan template retirement. Retire can take a future date
-- (retire_on, an America/Los_Angeles day): until then the template stays
-- published and in use, with a "Retiring on" warning wherever it's picked or
-- shown; on that day a nightly job retires it the way Retire does now
-- (status 'archived', retired_at stamped). The replacement, reason and who
-- scheduled it are saved up front in the retirement columns
-- (care_plan_template_retirement migration). Cancelling or restoring clears
-- retire_on (lib/templateRetirement.js).
--
-- Additive and idempotent.

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS retire_on date;

CREATE INDEX IF NOT EXISTS care_plan_templates_retire_on_idx
  ON public.care_plan_templates (retire_on) WHERE retire_on IS NOT NULL;

-- Retires every published template whose date has arrived. Returns how many.
CREATE OR REPLACE FUNCTION public.retire_scheduled_care_plan_templates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  n     integer;
BEGIN
  UPDATE care_plan_templates
     SET status = 'archived', retired_at = now(), retire_on = NULL,
         updated_by = coalesce(retired_by, updated_by), updated_at = now()
   WHERE retire_on IS NOT NULL AND retire_on <= today
     AND status NOT IN ('archived', 'draft');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.retire_scheduled_care_plan_templates() FROM PUBLIC, anon, authenticated;

-- 09:05 UTC is after midnight in Los Angeles in both PST and PDT.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.unschedule('retire-scheduled-care-plan-templates')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retire-scheduled-care-plan-templates');
SELECT cron.schedule('retire-scheduled-care-plan-templates', '5 9 * * *',
                     'SELECT public.retire_scheduled_care_plan_templates()');

NOTIFY pgrst, 'reload schema';

-- ── Verify ─────────────────────────────────────────────────────────────────
--   select name, status, retire_on, replaced_by_template_id from care_plan_templates where retire_on is not null;
--   select jobname, schedule, active from cron.job where jobname = 'retire-scheduled-care-plan-templates';
--
-- ── Rollback ───────────────────────────────────────────────────────────────
--   select cron.unschedule('retire-scheduled-care-plan-templates');
--   drop function if exists public.retire_scheduled_care_plan_templates();
--   drop index if exists public.care_plan_templates_retire_on_idx;
--   alter table public.care_plan_templates drop column if exists retire_on;
