-- Episodic care plan templates.
--
-- An episodic template covers one event rather than an ongoing condition:
-- a transition of care after an inpatient stay (30 days), after an ED visit
-- (14 days), or a home health episode (until someone closes it). Applying one
-- starts an episode:
--
--   * the run ends on day `episode_days` (day 1 is the day it starts), or has
--     no end date when episode_days is null ("until closed")
--   * when the plan is opened after that day, the run closes on its own: its
--     items move to the plan's history (as a reinstate does) and close_reason
--     records 'episode_end'. Someone can extend it before then, or end it now
--     ('ended_early')
--   * optionally (episode_pauses_ongoing, confirmed per patient when applied)
--     the patient's other active care plans pause for the episode with
--     pause_reason 'episode'. paused_plan_ids records exactly which, so only
--     those resume when it ends. Each also carries resume_on = the day after
--     the episode ends with auto_resume, so it comes back even if nobody opens
--     the episode's plan; extending the episode moves that date.
--
-- Additive and idempotent. No new table, so RLS is unchanged.

-- ── Templates ──────────────────────────────────────────────────────────────
ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS episodic               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS episode_days           integer,
  ADD COLUMN IF NOT EXISTS episode_pauses_ongoing boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_plan_templates_episode_days_check') THEN
    ALTER TABLE public.care_plan_templates
      ADD CONSTRAINT care_plan_templates_episode_days_check
      CHECK (episode_days IS NULL OR (episodic AND episode_days BETWEEN 1 AND 365));
  END IF;
END $$;

-- ── Runs ───────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_care_plan_template_instances
  ADD COLUMN IF NOT EXISTS episodic        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_plan_ids uuid[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS close_reason    text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_care_plan_template_instances_close_reason_check') THEN
    ALTER TABLE public.patient_care_plan_template_instances
      ADD CONSTRAINT patient_care_plan_template_instances_close_reason_check
      CHECK (close_reason IS NULL OR close_reason IN ('episode_end', 'ended_early'));
  END IF;
END $$;

-- ── Plans paused by an episode ─────────────────────────────────────────────
ALTER TABLE public.patient_care_plans
  DROP CONSTRAINT IF EXISTS patient_care_plans_pause_reason_check;
ALTER TABLE public.patient_care_plans
  ADD CONSTRAINT patient_care_plans_pause_reason_check
  CHECK (pause_reason IS NULL OR pause_reason IN ('hospitalized', 'traveling', 'patient_request', 'episode', 'other'));

-- ── Library ────────────────────────────────────────────────────────────────
-- Transitions of care after an inpatient stay run 30 days.
UPDATE public.care_plan_templates
SET episodic = true, episode_days = 30, renewal = 'reinstate'
WHERE name = 'Transitions of Care (TOC)' AND NOT episodic;

NOTIFY pgrst, 'reload schema';

-- ── Verify ─────────────────────────────────────────────────────────────────
--   select name, episodic, episode_days, episode_pauses_ongoing
--     from care_plan_templates where episodic;
--
-- ── Rollback ───────────────────────────────────────────────────────────────
--   update patient_care_plans set status = 'active', pause_reason = null, pause_note = null,
--     paused_on = null, resume_on = null, auto_resume = false, paused_by = null
--     where pause_reason = 'episode';
--   alter table patient_care_plans drop constraint if exists patient_care_plans_pause_reason_check;
--   alter table patient_care_plans add constraint patient_care_plans_pause_reason_check
--     check (pause_reason is null or pause_reason in ('hospitalized', 'traveling', 'patient_request', 'other'));
--   alter table patient_care_plan_template_instances
--     drop constraint if exists patient_care_plan_template_instances_close_reason_check,
--     drop column if exists close_reason, drop column if exists paused_plan_ids, drop column if exists episodic;
--   alter table care_plan_templates drop constraint if exists care_plan_templates_episode_days_check,
--     drop column if exists episode_pauses_ongoing, drop column if exists episode_days, drop column if exists episodic;
