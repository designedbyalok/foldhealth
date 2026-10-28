-- Settings → My Packages for the patient app (W11 in docs/features/patient-app-workflows.md).
-- Requires patient_accounts_migration.sql and patient_messages_migration.sql.
--
-- Packages are patient-facing wellness offerings (Figma 701:5439), not the
-- billing care programs in patient_care_programs, whose codes and outreach
-- statuses mean nothing to a patient.
--   • patient_packages: the catalog staff curate (title, summary, details)
--   • patient_package_enrollments: one row per profile and package, with
--     status requested | enrolled | opted_out
-- A patient asks to join or opt out; the request also lands in the care
-- team's Chat as a message from the patient, so staff act on it with the
-- tools they already have. Staff set status 'enrolled' when they enrol them.

begin;

create table if not exists public.patient_packages (
  id         text primary key,
  title      text not null,
  summary    text not null,
  details    text,
  icon       text not null default 'solar:box-linear',
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_package_enrollments (
  member_id    text not null,
  package_id   text not null references public.patient_packages (id) on delete cascade,
  status       text not null check (status in ('requested', 'enrolled', 'opted_out')),
  updated_at   timestamptz not null default now(),
  updated_by   text,
  primary key (member_id, package_id)
);

alter table public.patient_packages enable row level security;
alter table public.patient_package_enrollments enable row level security;
-- staff_only (restrictive) is added by the add_staff_only_policy event trigger.
drop policy if exists "Staff manage packages" on public.patient_packages;
create policy "Staff manage packages" on public.patient_packages
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "Staff manage package enrollments" on public.patient_package_enrollments;
create policy "Staff manage package enrollments" on public.patient_package_enrollments
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

insert into public.patient_packages (id, title, summary, details, icon, sort_order) values
  ('stress-wellness', 'Stress Management and Mental Wellness',
   'Tools and support to manage stress, sleep better and look after your mental well-being.',
   'Work with your care team on a plan for stress and sleep: short check-ins, guided breathing and relaxation routines, and a mood check every two weeks so your team can adjust the plan with you.',
   'solar:meditation-round-linear', 1),
  ('healthy-diet', 'Healthy Diet Plan',
   'A personal eating plan to reach a healthy weight and keep your energy up.',
   'Your care team sets food and activity goals with you, shares meal ideas that fit your conditions and budget, and follows up on your progress each month.',
   'solar:leaf-linear', 2),
  ('senior-health', 'Senior Health and Aging Gracefully',
   'Stay active, steady and independent with routines made for older adults.',
   'Balance and strength routines, a home safety review, medicine reviews and regular check-ins, so you can keep doing the things you enjoy.',
   'solar:walking-linear', 3),
  ('diabetes-self-care', 'Diabetes Self-Care',
   'Learn day-to-day skills to keep your blood sugar in range.',
   'Glucose tracking, foot and eye care reminders, and education on food, activity and medicines, with your care team reviewing your numbers with you.',
   'solar:heart-pulse-linear', 4)
on conflict (id) do nothing;

-- The catalog with this profile's status on each package.
create or replace function public.patient_packages_for(p_member_id text)
returns table (id text, title text, summary text, details text, icon text, status text, updated_at timestamptz)
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
    select p.id, p.title, p.summary, p.details, p.icon, e.status, e.updated_at
      from public.patient_packages p
      left join public.patient_package_enrollments e on e.package_id = p.id and e.member_id = p_member_id
     where p.active or e.status = 'enrolled'
     order by p.sort_order, p.title;
end;
$$;
revoke execute on function public.patient_packages_for(text) from public, anon;
grant execute on function public.patient_packages_for(text) to authenticated;

-- Asks to join (p_join) or opts out of a package, and tells the care team in Chat.
create or replace function public.patient_request_package(p_member_id text, p_package_id text, p_join boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  pkg record;
  v_status text := case when p_join then 'requested' else 'opted_out' end;
  current_status text;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into pkg from public.patient_packages p where p.id = p_package_id;
  if not found or (p_join and not pkg.active) then
    raise exception 'This package is not available' using errcode = '22023';
  end if;
  select e.status into current_status from public.patient_package_enrollments e
   where e.member_id = p_member_id and e.package_id = p_package_id;
  if p_join and current_status in ('requested', 'enrolled') then
    return current_status;
  end if;
  if not p_join and current_status is distinct from 'requested' and current_status is distinct from 'enrolled' then
    raise exception 'You are not in this package' using errcode = '22023';
  end if;

  insert into public.patient_package_enrollments (member_id, package_id, status, updated_by)
  values (p_member_id, p_package_id, v_status, public._patient_sender_name(p_member_id))
  on conflict (member_id, package_id) do update
    set status = excluded.status, updated_by = excluded.updated_by, updated_at = now();

  perform public.patient_start_conversation(
    p_member_id,
    case when p_join then 'I would like to join the ' || pkg.title || ' package. Can you help me get started?'
         else 'Please take me out of the ' || pkg.title || ' package.' end);
  return v_status;
end;
$$;
revoke execute on function public.patient_request_package(text, text, boolean) from public, anon;
grant execute on function public.patient_request_package(text, text, boolean) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_request_package(text, text, boolean);
--   drop function if exists public.patient_packages_for(text);
--   drop table if exists public.patient_package_enrollments;
--   drop table if exists public.patient_packages;
