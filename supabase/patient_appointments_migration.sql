-- Patients book and see their own visits (W12 in
-- docs/features/patient-app-workflows.md). Requires
-- patient_accounts_migration.sql.
--
-- Open slots are computed here, not in the browser: availability and other
-- patients' appointments stay staff-only. The rules mirror the staff app
-- (occursOn in src/features/settings/calendar/availability/newViewUtils.js,
-- windowsOn in CalendarAvailabilityLayer.jsx):
--   • days: 0 = Sunday; weekly blocks repeat every `repeat_interval` weeks
--     counted from the start date's week ('biweekly' = weekly every 2),
--     daily every N days, monthly on chosen weekday occurrences (-1 = last)
--   • slot hours are wall-clock times in the block's own timezone
--   • a slot is for its appointment type, or 'All appointment types'
--   • skip_holidays (default on) skips holiday_configurations that list the
--     block's location
-- A slot is free when the provider has no appointment overlapping it.
-- Appointments keep the staff calendar's text formats: date 'MM-DD-YYYY',
-- times '2:30 pm', read as wall-clock in the provider block's timezone.

begin;

-- Which visit types a patient may book online. Off by default; staff opt in.
alter table public.appointment_types
  add column if not exists patient_bookable boolean not null default false;

-- "60 min" → 60, "15-30 min" → 30 (the upper bound, so a slot fits the
-- longest version of the visit).
create or replace function public.appointment_type_minutes(p_duration text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select max((m)[1]::int) from regexp_matches(coalesce(p_duration, ''), '(\d+)', 'g') as m),
    30);
$$;

-- An appointment's stored date + time as a wall-clock timestamp; null when
-- the text doesn't parse.
create or replace function public.appointment_wall(p_date text, p_time text)
returns timestamp
language plpgsql
stable
set search_path = ''
set timezone = 'UTC'
as $$
begin
  return to_timestamp(p_date || ' ' || upper(p_time), 'MM-DD-YYYY HH12:MI AM')::timestamp;
exception when others then
  return null;
end;
$$;

-- Every open slot for one appointment type over p_days days from p_from,
-- optionally for one provider. Internal: no access check, so not granted to
-- clients; the patient_* functions below call it after checking.
create or replace function public._appointment_open_slots(
  p_type_id uuid, p_from date, p_days integer, p_user_id text default null)
returns table (user_id text, provider_name text, location text, timezone text,
               starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  b record;
  s jsonb;
  d date;
  start_d date;
  n integer;
  mins integer;
  tz text;
  cur timestamptz;
  win_end timestamptz;
begin
  select * into t from public.appointment_types where id = p_type_id;
  if not found then return; end if;
  mins := public.appointment_type_minutes(t.duration);

  for b in
    select * from public.user_availability ua
     where (p_user_id is null or ua.user_id = p_user_id)
       and (ua.end_date is null or ua.end_date >= p_from)
  loop
    tz := coalesce(nullif(b.timezone, ''), 'America/New_York');
    n := case when b.repeat = 'biweekly' then 2 else greatest(coalesce(b.repeat_interval, 1), 1) end;
    start_d := coalesce(b.start_date, p_from);

    for i in 0 .. greatest(p_days, 1) - 1 loop
      d := p_from + i;
      continue when b.start_date is not null and d < b.start_date;
      continue when b.end_date is not null and d > b.end_date;

      if b.repeat = 'daily' then
        continue when (d - start_d) % n <> 0;
      else
        continue when not (extract(dow from d)::int = any (coalesce(b.days, '{}')));
        if b.repeat = 'monthly' then
          continue when ((extract(year from d) - extract(year from start_d)) * 12
                          + extract(month from d) - extract(month from start_d))::int % n <> 0;
          continue when not (
            ceil(extract(day from d) / 7.0)::int = any (coalesce(b.weeks, '{}'))
            or (extract(month from d + 7) <> extract(month from d) and -1 = any (coalesce(b.weeks, '{}'))));
        else
          continue when floor(((d - start_d) + extract(dow from start_d)) / 7.0)::int % n <> 0;
        end if;
      end if;

      for s in select * from jsonb_array_elements(coalesce(b.slots, '[]'::jsonb)) loop
        continue when coalesce(s->>'start', '') = '' or coalesce(s->>'end', '') = '';
        continue when coalesce(s->>'appointmentType', '') not in ('All appointment types', t.name);
        cur := (d + (s->>'start')::time) at time zone tz;
        win_end := (d + (s->>'end')::time) at time zone tz;

        while cur + make_interval(mins => mins) <= win_end loop
          if cur >= now() + interval '2 hours'
             and not (coalesce(b.skip_holidays, true) and exists (
               select 1 from public.holiday_configurations h
                where b.location = any (h.locations)
                  and h.start_at < cur + make_interval(mins => mins)
                  and h.end_at > cur))
             and not exists (
               select 1 from public.appointments a
                where coalesce(a.status, '') not in ('Cancelled', 'Canceled')
                  and (a.primary_user_id = b.user_id
                       or (a.primary_user_id is null and a.primary_user = b.user_name))
                  and (public.appointment_wall(a.date, a.time_start) at time zone tz) < cur + make_interval(mins => mins)
                  and (public.appointment_wall(a.date, coalesce(a.time_end, a.time_start)) at time zone tz) > cur)
          then
            user_id := b.user_id;
            provider_name := b.user_name;
            location := b.location;
            timezone := tz;
            starts_at := cur;
            ends_at := cur + make_interval(mins => mins);
            return next;
          end if;
          cur := cur + make_interval(mins => mins);
        end loop;
      end loop;
    end loop;
  end loop;
end;
$$;
revoke execute on function public._appointment_open_slots(uuid, date, integer, text) from public, anon, authenticated;

-- Visit types a patient may book.
create or replace function public.patient_bookable_appointment_types()
returns table (id uuid, name text, mode text, duration_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.mode, public.appointment_type_minutes(t.duration)
    from public.appointment_types t
   where t.patient_bookable
     and exists (select 1 from public.patient_accounts pa where pa.user_id = auth.uid())
   order by t.name;
$$;
revoke execute on function public.patient_bookable_appointment_types() from public, anon;
grant execute on function public.patient_bookable_appointment_types() to authenticated;

-- Open slots for a patient, one row per provider + start time, up to 31 days.
create or replace function public.patient_available_slots(
  p_member_id text, p_type_id uuid, p_from date, p_days integer default 14)
returns table (user_id text, provider_name text, location text, timezone text,
               starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.appointment_types where id = p_type_id and patient_bookable) then
    raise exception 'This visit type cannot be booked online' using errcode = '22023';
  end if;
  return query
    select distinct on (s.starts_at, s.user_id)
           s.user_id, s.provider_name, s.location, s.timezone, s.starts_at, s.ends_at
      from public._appointment_open_slots(p_type_id, greatest(p_from, current_date),
                                          least(greatest(p_days, 1), 31)) s
     order by s.starts_at, s.user_id;
end;
$$;
revoke execute on function public.patient_available_slots(text, uuid, date, integer) from public, anon;
grant execute on function public.patient_available_slots(text, uuid, date, integer) to authenticated;

-- Books one slot. Re-checks it under a per-provider lock, so two patients
-- can't take the same time. At most 3 upcoming online bookings per patient.
create or replace function public.patient_book_appointment(
  p_member_id text, p_type_id uuid, p_user_id text, p_starts_at timestamptz,
  p_mode text default null, p_reason text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t record;
  slot record;
  v_mode text;
  v_name text;
  v_id uuid;
  v_open integer;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into t from public.appointment_types where id = p_type_id and patient_bookable;
  if not found then
    raise exception 'This visit type cannot be booked online' using errcode = '22023';
  end if;

  v_mode := case
    when t.mode ilike '%/%' and p_mode in ('In-person', 'Virtual') then p_mode
    when t.mode ilike '%/%' then 'In-person'
    else t.mode end;

  perform pg_advisory_xact_lock(hashtext('appointment-provider:' || p_user_id));

  select count(*) into v_open
    from public.appointments a
   where a.patient_id = p_member_id
     and a.status = 'Booked'
     and public.appointment_wall(a.date, a.time_start) > (now() at time zone 'UTC') - interval '1 day';
  if v_open >= 3 then
    raise exception 'You already have 3 upcoming visits booked online. Please contact your care team to book more.'
      using errcode = 'P0001';
  end if;

  select * into slot
    from public._appointment_open_slots(p_type_id, (p_starts_at at time zone 'UTC')::date - 1, 3, p_user_id) s
   where s.starts_at = p_starts_at
   limit 1;
  if not found then
    raise exception 'That time is no longer available. Please pick another.' using errcode = 'P0001';
  end if;

  select a.name into v_name from public.all_patients a
   where a.member_id = p_member_id order by a.updated_at desc nulls last limit 1;

  insert into public.appointments (
    patient_id, patient_name, appointment_type_id, appointment_type_name, mode, location,
    primary_user, primary_user_id, date, time_start, time_end, reason_for_visit, status)
  values (
    p_member_id, v_name, t.id, t.name, v_mode, slot.location,
    slot.provider_name, slot.user_id,
    to_char(slot.starts_at at time zone slot.timezone, 'MM-DD-YYYY'),
    to_char(slot.starts_at at time zone slot.timezone, 'FMHH12:MI am'),
    to_char(slot.ends_at at time zone slot.timezone, 'FMHH12:MI am'),
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    'Booked')
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.patient_book_appointment(text, uuid, text, timestamptz, text, text) from public, anon;
grant execute on function public.patient_book_appointment(text, uuid, text, timestamptz, text, text) to authenticated;

-- A patient's upcoming visits, patient-safe columns only (no staff notes).
create or replace function public.patient_upcoming_appointments(p_member_id text)
returns table (id uuid, type_name text, mode text, location text, provider_name text,
               date text, time_start text, time_end text, status text,
               member_instruction text, reason_for_visit text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select a.id, a.appointment_type_name, a.mode, a.location, a.primary_user,
           a.date, a.time_start, a.time_end, a.status, a.member_instruction, a.reason_for_visit
      from public.appointments a
     where a.patient_id = p_member_id
       and coalesce(a.status, '') not in ('Cancelled', 'Canceled', 'Completed', 'No Show')
       and public.appointment_wall(a.date, a.time_start)::date >= current_date
     order by public.appointment_wall(a.date, a.time_start);
end;
$$;
revoke execute on function public.patient_upcoming_appointments(text) from public, anon;
grant execute on function public.patient_upcoming_appointments(text) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_upcoming_appointments(text);
--   drop function if exists public.patient_book_appointment(text, uuid, text, timestamptz, text, text);
--   drop function if exists public.patient_available_slots(text, uuid, date, integer);
--   drop function if exists public.patient_bookable_appointment_types();
--   drop function if exists public._appointment_open_slots(uuid, date, integer, text);
--   drop function if exists public.appointment_wall(text, text);
--   drop function if exists public.appointment_type_minutes(text);
--   alter table public.appointment_types drop column if exists patient_bookable;
