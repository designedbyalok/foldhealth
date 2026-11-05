-- First-party funnel tracking: one row per funnel step a user touches.
--
-- WHY THIS EXISTS
-- Vercel Analytics custom events are anonymous and unstitchable: you can see
-- that 100 `schedule.drawer_opened` and 60 `schedule.booking_completed` fired,
-- but not whether the same session walked patient → type → submit → success
-- or vanished after picking a patient. This table stores each step with an
-- anonymous per-tab session id, so drop-off becomes plain SQL:
--
--   -- Where do booking attempts die?
--   select event_name, count(*) from public.funnel_events
--    where funnel = 'schedule_appointment' group by 1 order by 2 desc;
--
--   -- Step-by-step conversion for one entry point
--   select event_name, count(distinct session_id)
--     from public.funnel_events
--    where funnel = 'schedule_appointment' and props->>'source' = 'topbar'
--    group by 1;
--
--   -- Median time from open to completed booking
--   select percentile_cont(0.5) within group (order by (props->>'durationMs')::int)
--     from public.funnel_events where event_name = 'schedule.booking_completed';
--
-- WHAT GOES IN HERE
-- Only product funnel steps, fired through tracking.js's trackFunnel() (which
-- also mirrors to Vercel + Sentry). Plain nav/theme events stay out on purpose.
-- PHI policy applies: opaque ids only, never names/emails/phone numbers.
--
-- NO SEED BY DESIGN
-- Seeding synthetic sessions would contaminate real completion rates. The
-- table fills organically as the ScheduleDrawer is used. If you want demo
-- data, run the commented block at the bottom.

begin;

create table if not exists public.funnel_events (
  id         uuid primary key default gen_random_uuid(),
  -- Random uuid minted per browser tab in tracking.js. Deliberately NOT a
  -- foreign key: it identifies a browsing session, not any profile row.
  session_id uuid        not null,
  -- Which funnel this row belongs to ('schedule_appointment' today), so the
  -- table can serve future funnels without new tables.
  funnel     text        not null,
  event_name text        not null,
  props      jsonb       not null default '{}'::jsonb,
  -- Stamped by the database from the insert's JWT: the client never sends it,
  -- so rows can't be forged against another user.
  user_id    uuid        default auth.uid(),
  created_at timestamptz not null default now()
);

-- Path reconstruction: "everything this session did in this funnel, in order".
create index if not exists funnel_events_session_idx
  on public.funnel_events (funnel, session_id, created_at);

-- Trend lines: "completed bookings per day" / "failures this week".
create index if not exists funnel_events_event_time_idx
  on public.funnel_events (event_name, created_at desc);

alter table public.funnel_events enable row level security;

drop policy if exists funnel_events_insert_own on public.funnel_events;
create policy funnel_events_insert_own
  on public.funnel_events for insert
  to authenticated
  with check ((select auth.uid()) is not null);

-- Readable app-wide (no PHI: opaque ids only) so a future in-app funnel
-- dashboard can query every session, like the analytics tables it mirrors.
drop policy if exists funnel_events_select_authenticated on public.funnel_events;
create policy funnel_events_select_authenticated
  on public.funnel_events for select
  to authenticated
  using ((select auth.uid()) is not null);

-- No update/delete policies: an event log is immutable. Cleanup of aged rows,
-- if ever needed, is a service-role job.

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- As any signed-in user, book a test appointment in the app, then:
--   select event_name, props, user_id is not null as attributed
--     from public.funnel_events order by created_at desc limit 8;
--   Expect opened → patient_selected → type_selected → submitted →
--   booking_completed rows sharing one session_id, attributed = true.
--
-- Close the drawer mid-form (no save) and re-check:
--   Expect one schedule.drawer_abandoned row with lastStep set.
--
-- Anon writes must fail:
--   set role anon;
--   insert into public.funnel_events (session_id, funnel, event_name)
--     values (gen_random_uuid(), 'x', 'test');
--   Expect: permission denied (RLS).
--
-- ── Optional demo seed (run manually ONLY in a scratch project) ────────────
-- insert into public.funnel_events (session_id, funnel, event_name, props, created_at)
-- select s.sid, 'schedule_appointment', e.name, e.props::jsonb, now() - (s.offset_mins || ' mins')::interval
-- from (values
--   (gen_random_uuid(), 40), (gen_random_uuid(), 35), (gen_random_uuid(), 28),
--   (gen_random_uuid(), 20), (gen_random_uuid(), 12)
-- ) as s(sid, offset_mins)
-- cross join (values
--   ('schedule.drawer_opened',      '{"source":"topbar"}'),
--   ('schedule.patient_selected',   '{}'),
--   ('schedule.type_selected',      '{"typeName":"Annual Wellness Visit"}'),
--   ('schedule.submitted',          '{}'),
--   ('schedule.booking_completed',  '{"durationMs":95000}')
-- ) as e(name, props);
--
-- ── Rollback ────────────────────────────────────────────────────────────────
-- drop table if exists public.funnel_events;
