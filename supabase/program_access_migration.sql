-- Phase 2B.1: who works in which care program, and in what capacity.
--
-- WHY
-- Care Program Configuration stores access.enrollRoles / navigationRoles,
-- but nothing links a user to the programs they work in, there is no vendor
-- organization, and nothing records a supervisor stepping outside their
-- scope. This adds:
--
--   vendor_organizations  Internal teams and delegated vendors that staff
--                         work for (e.g. an outsourced CCM vendor).
--   program_memberships   One row per user and program: access level
--                         (viewer | member | supervisor), care team role
--                         (Care Manager, Physician/PCP, ...; drives BHI
--                         co-sign), vendor organization, active flag.
--   access_override_log   Append-only audit of supervisor overrides: who,
--                         which patient and program, what, and why.
--
-- ENFORCEMENT
-- App-level for now (agreed 2026-10-23): the app scopes views, search,
-- lists, notifications and edit rights from program_memberships. Reads stay
-- "signed-in only", per supabase/RLS_POSTURE.md; membership-based row
-- policies belong to a separate tenancy project. The one exception is
-- writes to program_memberships and vendor_organizations, which are
-- admin-only, the same guard profiles_guard_authz_fields.sql puts on role
-- changes, so nobody can make themselves a supervisor. The admin predicate
-- below mirrors is_profile_admin() (which has no EXECUTE grant for
-- authenticated, so a policy can't call it).
--
-- A user with no memberships is unscoped (sees everything) until someone
-- assigns them, so this migration changes nothing for anyone on its own.
--
-- Additive and idempotent. Seed: program_access_seed.sql.
-- Ask Alok Kumar to run this migration, then the seed, on Supabase.

begin;

create table if not exists public.vendor_organizations (
  id          text        primary key,
  name        text        not null,
  kind        text        not null default 'vendor' check (kind in ('internal', 'vendor')),
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.program_memberships (
  id              text        primary key,
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  program_code    text        not null,
  access_level    text        not null default 'member' check (access_level in ('viewer', 'member', 'supervisor')),
  care_team_role  text,
  vendor_org_id   text        references public.vendor_organizations(id) on delete set null,
  active          boolean     not null default true,
  updated_by      text,
  updated_at      timestamptz not null default now(),
  unique (user_id, program_code)
);

create index if not exists program_memberships_user_idx on public.program_memberships (user_id) where active;

create table if not exists public.access_override_log (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null default auth.uid(),
  user_name     text,
  patient_id    text,
  program_code  text        not null,
  action        text        not null,
  reason        text        not null check (length(btrim(reason)) >= 10),
  created_at    timestamptz not null default now()
);

create index if not exists access_override_log_patient_idx on public.access_override_log (patient_id, created_at desc);

alter table public.vendor_organizations enable row level security;
alter table public.program_memberships enable row level security;
alter table public.access_override_log enable row level security;

-- Reads: any signed-in user (RLS_POSTURE.md).
drop policy if exists vendor_organizations_select on public.vendor_organizations;
create policy vendor_organizations_select on public.vendor_organizations
  for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists program_memberships_select on public.program_memberships;
create policy program_memberships_select on public.program_memberships
  for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists access_override_log_select on public.access_override_log;
create policy access_override_log_select on public.access_override_log
  for select to authenticated using ((select auth.uid()) is not null);

-- Writes to the authorization tables: admins only.
drop policy if exists vendor_organizations_admin_write on public.vendor_organizations;
create policy vendor_organizations_admin_write on public.vendor_organizations
  for all to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))))
  with check (exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))));

drop policy if exists program_memberships_admin_write on public.program_memberships;
create policy program_memberships_admin_write on public.program_memberships
  for all to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))))
  with check (exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))));

-- Overrides: insert as yourself only; no update or delete, so it's an audit.
drop policy if exists access_override_log_insert on public.access_override_log;
create policy access_override_log_insert on public.access_override_log
  for insert to authenticated with check (user_id = (select auth.uid()));

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop table if exists public.access_override_log;
--   drop table if exists public.program_memberships;
--   drop table if exists public.vendor_organizations;
