-- funnel_events_queries.sql, copy-paste recipes for the booking funnel.
-- Run in the Supabase SQL editor (Database → SQL editor).
-- Schema: see funnel_events_migration.sql. Events come from the ScheduleDrawer.

-- ── 1. Did they finish or drop off, per entry point? ───────────────────────
select
  props->>'source'                                                   as source,
  count(*) filter (where event_name = 'schedule.drawer_opened')      as opened,
  count(*) filter (where event_name = 'schedule.patient_selected')   as picked_patient,
  count(*) filter (where event_name = 'schedule.type_selected')      as picked_type,
  count(*) filter (where event_name = 'schedule.submitted')          as submitted,
  count(*) filter (where event_name = 'schedule.booking_completed')  as completed,
  count(*) filter (where event_name = 'schedule.booking_failed')     as failed,
  round(100.0 * count(*) filter (where event_name = 'schedule.booking_completed')
        / nullif(count(*) filter (where event_name = 'schedule.drawer_opened'), 0), 1) as completion_pct
from public.funnel_events
where funnel = 'schedule_appointment'
group by 1
order by opened desc;

-- ── 2. How far did abandoners get? (lastStep: 1 open, 2 patient, 3 type) ───
select
  props->>'lastStep'                    as last_step,
  case props->>'lastStep'
    when '1' then 'Opened, did nothing'
    when '2' then 'Stopped after picking patient'
    when '3' then 'Stopped after picking type'
  end                                   as interpretation,
  count(*)                              as sessions
from public.funnel_events
where event_name = 'schedule.drawer_abandoned'
group by 1, 2
order by 1;

-- ── 3. How long does a successful booking take? (p50 / p90) ────────────────
select
  percentile_cont(0.5) within group (order by (props->>'durationMs')::int) / 1000.0 as median_seconds,
  percentile_cont(0.9) within group (order by (props->>'durationMs')::int) / 1000.0 as p90_seconds
from public.funnel_events
where event_name = 'schedule.booking_completed';

-- ── 4. Daily trend, starts vs completions vs abandonment ──────────────────
select
  created_at::date                                                     as day,
  count(*) filter (where event_name = 'schedule.drawer_opened')        as opened,
  count(*) filter (where event_name = 'schedule.booking_completed')    as completed,
  count(*) filter (where event_name = 'schedule.drawer_abandoned')     as abandoned,
  count(*) filter (where event_name = 'schedule.booking_failed')       as failed
from public.funnel_events
where funnel = 'schedule_appointment'
group by 1
order by 1 desc;

-- ── 5. Reconstruct one abandoned session's path (pick a session_id from #2) 
select event_name, props, created_at
from public.funnel_events
where session_id = '<session_id>'
order by created_at;

-- ── 6. Preset-patient entry points: do they convert better? ────────────────
select
  props->>'source'                                                  as source,
  props->>'hadPatientPreset'                                        as preset,
  count(*)                                                          as opened,
  count(*) filter (where event_name = 'schedule.booking_completed') as completed,
  round(100.0 * count(*) filter (where event_name = 'schedule.booking_completed') / count(*), 1) as completion_pct
from public.funnel_events
where funnel = 'schedule_appointment'
group by 1, 2
order by opened desc;

-- ── 7. Which appointment types get chosen most? ────────────────────────────
select props->>'typeName' as type_name, count(*) as picks
from public.funnel_events
where event_name = 'schedule.type_selected'
group by 1
order by picks desc;
