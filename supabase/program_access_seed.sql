-- Seed for program_access_migration.sql. Run the migration first.
--
-- Built from data we already have, not invented assignments:
--   - One internal organization, "Fold Health Care Team".
--   - Admins (same predicate as the migration's write policy) become
--     supervisors of every program: the active care_program_types codes,
--     plus any code already used in patient_care_programs.
--   - Everyone named as an assignee on a patient's program
--     (patient_care_programs.assignee, matched to profiles.full_name)
--     becomes a member of that program as a Care Manager.
-- Users who match neither get no rows and stay unscoped, as today.
--
-- Idempotent: rewrites only rows whose id starts with 'seed-'.
-- Ask Alok Kumar to run this seed on Supabase.

begin;

insert into public.vendor_organizations (id, name, kind)
values ('internal', 'Fold Health Care Team', 'internal')
on conflict (id) do nothing;

delete from public.program_memberships where id like 'seed-%';

with codes as (
  select code from public.care_program_types where status = 'active'
  union
  select distinct code from public.patient_care_programs
),
admins as (
  select p.id from public.profiles p
   where p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
      or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}'))
)
insert into public.program_memberships (id, user_id, program_code, access_level, care_team_role, vendor_org_id, updated_by)
select 'seed-' || a.id || '-' || lower(regexp_replace(c.code, '[^A-Za-z0-9]+', '-', 'g')),
       a.id, c.code, 'supervisor', null, 'internal', 'seed'
from admins a cross join codes c
on conflict (user_id, program_code) do nothing;

insert into public.program_memberships (id, user_id, program_code, access_level, care_team_role, vendor_org_id, updated_by)
select distinct on (p.id, pcp.code)
       'seed-' || p.id || '-' || lower(regexp_replace(pcp.code, '[^A-Za-z0-9]+', '-', 'g')),
       p.id, pcp.code, 'member', 'Care Manager', 'internal', 'seed'
from public.patient_care_programs pcp
join public.profiles p on lower(btrim(p.full_name)) = lower(btrim(pcp.assignee))
where coalesce(btrim(pcp.assignee), '') <> ''
on conflict (user_id, program_code) do nothing;

commit;
