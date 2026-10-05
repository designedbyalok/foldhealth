-- Clear care-plan dates the app invented, so the plan only shows dates a
-- clinician actually set.
--
-- Until this change the store seeded a default on every save when no date was
-- given: goals got target_date = created + 90 days, interventions got
-- config.dueDateOverride = created + 30 days. Those defaults were stored in the
-- same fields as a clinician-picked date and displayed identically.
--
-- A stored date is treated as a seeded default when it equals created + N
-- (±1 day, because the default was computed in the browser's local timezone)
-- AND the item has no date edit in care_plan_audit. Anything with an audited
-- date change is kept, even if it happens to match the default.
--
-- Safe to re-run: the snapshot uses CREATE TABLE IF NOT EXISTS and only rows
-- still matching the rule are touched. Roll back from care_plan_bak.

begin;

create schema if not exists care_plan_bak;

-- ── Snapshot (rollback source) ─────────────────────────────────────────
create table if not exists care_plan_bak.seeded_goal_target_dates as
select g.id, g.target_date, now() as snapshot_at
from public.patient_care_plan_goals g
where nullif(left(g.target_date, 10), '') ~ '^\d{4}-\d{2}-\d{2}$'
  and left(g.target_date, 10)::date between g.created_at::date + 89 and g.created_at::date + 91
  and not exists (
    select 1 from public.care_plan_audit a
    where a.entity_type = 'goal'
      and a.entity_id = g.id::text
      and a.action = 'target_date_changed'
  );

create table if not exists care_plan_bak.seeded_intervention_due_dates as
select i.id, i.config -> 'dueDateOverride' as due_date_override, now() as snapshot_at
from public.patient_care_plan_interventions i
where nullif(left(i.config ->> 'dueDateOverride', 10), '') ~ '^\d{4}-\d{2}-\d{2}$'
  and left(i.config ->> 'dueDateOverride', 10)::date between i.created_at::date + 29 and i.created_at::date + 31
  and not exists (
    select 1 from public.care_plan_audit a
    where a.entity_type = 'intervention'
      and a.entity_id = i.id::text
      and a.detail ilike 'Due Date:%'
  );

-- ── Clear the seeded values ────────────────────────────────────────────
-- Goals store an empty string for "no target date" (patientCarePlanGoalToRow).
update public.patient_care_plan_goals g
set target_date = ''
from care_plan_bak.seeded_goal_target_dates s
where s.id = g.id
  and g.target_date = s.target_date;

update public.patient_care_plan_interventions i
set config = i.config - 'dueDateOverride'
from care_plan_bak.seeded_intervention_due_dates s
where s.id = i.id
  and i.config -> 'dueDateOverride' = s.due_date_override;

commit;

-- Rollback:
-- update public.patient_care_plan_goals g set target_date = s.target_date
--   from care_plan_bak.seeded_goal_target_dates s where s.id = g.id;
-- update public.patient_care_plan_interventions i
--   set config = jsonb_set(i.config, '{dueDateOverride}', s.due_date_override)
--   from care_plan_bak.seeded_intervention_due_dates s where s.id = i.id;
