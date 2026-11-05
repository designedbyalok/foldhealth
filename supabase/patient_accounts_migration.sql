-- Patient accounts → the patient records they may act for (W2 in
-- docs/features/patient-app-workflows.md).
--
-- One sign-in can manage several people (a parent and their child, a
-- caregiver). Each row links an auth user with app_metadata.role = 'patient'
-- to one member_id (the Fold ID every source table keys patients by).
--
-- Patients never read this or any other table directly: every table stays
-- behind the RESTRICTIVE staff_only policy (staff_patient_rls_split_migration
-- .sql). The patient app calls SECURITY DEFINER functions that check the
-- caller's link first and return only patient-safe columns.

begin;

create table if not exists public.patient_accounts (
  user_id      uuid not null references auth.users (id) on delete cascade,
  member_id    text not null,
  relationship text not null default 'self'
               check (relationship in ('self', 'dependent', 'caregiver')),
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  primary key (user_id, member_id)
);
create index if not exists patient_accounts_member_idx on public.patient_accounts (member_id);

alter table public.patient_accounts enable row level security;
-- staff_only (restrictive) is added by the add_staff_only_policy event trigger.
drop policy if exists "Staff manage patient accounts" on public.patient_accounts;
create policy "Staff manage patient accounts" on public.patient_accounts
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- True when the signed-in user is a patient linked to p_member_id.
create or replace function public.patient_can_access(p_member_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.patient_accounts pa
      join auth.users u on u.id = pa.user_id
     where pa.user_id = auth.uid()
       and pa.member_id = p_member_id
       and u.raw_app_meta_data->>'role' = 'patient'
  );
$$;
revoke execute on function public.patient_can_access(text) from public, anon;
grant execute on function public.patient_can_access(text) to authenticated;

-- The profiles the signed-in patient may switch between, primary first.
create or replace function public.patient_profiles()
returns table (
  member_id    text,
  relationship text,
  is_primary   boolean,
  name         text,
  initials     text,
  gender       text,
  dob          text,
  email        text,
  phone        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.member_id, pa.relationship, pa.is_primary,
         ap.name, ap.initials, ap.gender, ap.dob::text, ap.email, ap.phone
    from public.patient_accounts pa
    left join lateral (
      select a.name, a.initials, a.gender, a.dob, a.email, a.phone
        from public.all_patients a
       where a.member_id = pa.member_id
       order by a.updated_at desc nulls last
       limit 1
    ) ap on true
   where pa.user_id = auth.uid()
     and public.patient_can_access(pa.member_id)
   order by pa.is_primary desc, ap.name;
$$;
revoke execute on function public.patient_profiles() from public, anon;
grant execute on function public.patient_profiles() to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_profiles();
--   drop function if exists public.patient_can_access(text);
--   drop table if exists public.patient_accounts;
