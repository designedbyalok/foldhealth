-- Provider-portal users sign in to the patient portal with the same account
-- and view it as any patient. Requires patient_accounts_migration.sql,
-- patient_appointments_migration.sql and patient_messages_migration.sql.
--
-- Staff can already read every patient through the staff app (is_staff()
-- passes every table's staff_only policy), so letting them call the patient
-- functions for any member grants nothing new. What changes:
--   • patient_can_access(member) is true for staff as well as for patients
--     linked to that member, so every patient_* function works for staff
--   • staff search patients to view as (staff_view_as_search) and see which
--     patients use the portal (staff_view_as_featured)
--   • a message staff send from the patient app is labeled with their name
--     and "(staff, viewing as patient)", and a visit they book notes who
--     booked it in staff_instruction (never shown to patients), so neither
--     can pass for the patient's own

begin;

create or replace function public.patient_can_access(p_member_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1
      from public.patient_accounts pa
      join auth.users u on u.id = pa.user_id
     where pa.user_id = auth.uid()
       and pa.member_id = p_member_id
       and u.raw_app_meta_data->>'role' = 'patient'
  );
$$;

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
     and (public.is_staff()
          or exists (select 1 from public.patient_accounts pa where pa.user_id = auth.uid()))
   order by t.name;
$$;

create or replace function public._patient_sender_name(p_member_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when pa.relationship = 'self'
                 then coalesce((select a.name from public.all_patients a where a.member_id = p_member_id
                                 order by a.updated_at desc nulls last limit 1), 'Patient')
                 else coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email) || ' ('
                      || case pa.relationship when 'dependent' then 'parent or guardian' else 'caregiver' end || ')'
            end
       from public.patient_accounts pa
       join auth.users u on u.id = pa.user_id
      where pa.user_id = auth.uid() and pa.member_id = p_member_id),
    (select coalesce(nullif(p.full_name, ''), u.email) || ' (staff, viewing as patient)'
       from auth.users u
       left join public.profiles p on p.id = u.id
      where u.id = auth.uid() and public.is_staff()));
$$;

-- Same as patient_appointments_migration.sql, plus the staff note.
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
    primary_user, primary_user_id, date, time_start, time_end, reason_for_visit, staff_instruction, status)
  values (
    p_member_id, v_name, t.id, t.name, v_mode, slot.location,
    slot.provider_name, slot.user_id,
    to_char(slot.starts_at at time zone slot.timezone, 'MM-DD-YYYY'),
    to_char(slot.starts_at at time zone slot.timezone, 'FMHH12:MI am'),
    to_char(slot.ends_at at time zone slot.timezone, 'FMHH12:MI am'),
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    case when public.is_staff() then
      'Booked by ' || coalesce((select nullif(pr.full_name, '') from public.profiles pr where pr.id = auth.uid()), 'staff')
      || ' in the patient portal, viewing as the patient.'
    end,
    'Booked')
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.patient_book_appointment(text, uuid, text, timestamptz, text, text) from public, anon;
grant execute on function public.patient_book_appointment(text, uuid, text, timestamptz, text, text) to authenticated;

-- Patients to view as, matched on name or member id. Staff only.
create or replace function public.staff_view_as_search(p_query text)
returns table (member_id text, relationship text, is_primary boolean, name text, initials text,
               gender text, dob text, email text, phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := btrim(coalesce(p_query, ''));
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if length(q) < 2 then return; end if;
  return query
    select m.* from (
      select distinct on (a.member_id)
             a.member_id, 'staff_view'::text, false, a.name, a.initials, a.gender, a.dob::text, a.email, a.phone
        from public.all_patients a
       where a.member_id is not null
         and (a.name ilike '%' || q || '%' or a.member_id ilike q || '%')
       order by a.member_id, a.updated_at desc nulls last
    ) m
    order by m.name
    limit 20;
end;
$$;

-- Patients who have a patient portal account, for the top of the picker.
create or replace function public.staff_view_as_featured()
returns table (member_id text, relationship text, is_primary boolean, name text, initials text,
               gender text, dob text, email text, phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select m.* from (
    select distinct on (pa.member_id)
           pa.member_id, 'staff_view'::text, false, ap.name, ap.initials, ap.gender, ap.dob::text, ap.email, ap.phone
      from public.patient_accounts pa
      left join lateral (
        select a.name, a.initials, a.gender, a.dob, a.email, a.phone
          from public.all_patients a
         where a.member_id = pa.member_id
         order by a.updated_at desc nulls last
         limit 1
      ) ap on true
     order by pa.member_id
    ) m
    order by m.name
    limit 20;
end;
$$;

revoke execute on function public.staff_view_as_search(text) from public, anon;
grant execute on function public.staff_view_as_search(text) to authenticated;
revoke execute on function public.staff_view_as_featured() from public, anon;
grant execute on function public.staff_view_as_featured() to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.staff_view_as_featured();
--   drop function if exists public.staff_view_as_search(text);
--   restore patient_can_access, patient_bookable_appointment_types,
--   patient_book_appointment and _patient_sender_name from their original
--   migrations
