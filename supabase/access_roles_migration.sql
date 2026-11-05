-- Access Control (Settings > Account > Access Control).
--
-- One row per role. `permissions` maps a permission key (src/lib/accessControl.js)
-- to false when it's switched off; a key that isn't there is allowed, so
-- adding a permission or a role never locks anybody out. Built-in roles are
-- the ones the app ships with: code matches on their names, so they can't be
-- renamed or deleted, only have their permissions changed.
--
-- The app only hides pages and actions with this. Row level security on the
-- data itself is unchanged.
--
-- Run AFTER security_hardening_20261022b_migration.sql: it redefines
-- enforce_profile_authz_fields() from that file with one addition (see 3).
-- Idempotent.

begin;

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.access_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  built_in    boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.access_roles enable row level security;

-- Everyone signed in reads it (the app hides what their roles can't see);
-- only an active practice admin changes it.
drop policy if exists access_roles_select on public.access_roles;
create policy access_roles_select on public.access_roles
  for select to authenticated using (true);

drop policy if exists access_roles_admin_write on public.access_roles;
create policy access_roles_admin_write on public.access_roles
  for all to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and coalesce(p.status, 'Active') = 'Active'
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))
  ))
  with check (exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and coalesce(p.status, 'Active') = 'Active'
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))
  ));

-- ── 2. Built-in roles, everything allowed ───────────────────────────────────
insert into public.access_roles (name, built_in)
values
  ('Support', true), ('Coder', true), ('QA', true), ('Compliance', true),
  ('Physician/Doctor', true), ('Nurse', true), ('Medical Assistant', true),
  ('Admin/Practice Manager', true), ('Billing Specialist', true),
  ('Front Desk Staff/Receptionist', true), ('Lab Technician', true),
  ('Pharmacist', true), ('Health Information Manager (HIM)', true),
  ('Radiologist', true), ('Phlebotomist', true)
on conflict (name) do update set built_in = true;

-- ── 3. Let the two functions below update clinical_roles ────────────────────
-- Same as security_hardening_20261022b, plus the first check: a rename or
-- delete of a role has to change other users' clinical_roles (and the
-- admin's own, when they hold it). Only those functions set the flag, and it
-- lasts for their transaction alone; the API can't set it.
create or replace function public.enforce_profile_authz_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if current_setting('fold.access_role_change', true) = 'on' then
    return new;
  end if;

  if caller is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_profile_admin(caller) then
      new.admin_role     := 'Employer';
      new.role           := 'Viewer';
      new.clinical_roles := null;
      new.status         := 'Pending';
    end if;
    return new;
  end if;

  if new.admin_role         is not distinct from old.admin_role
     and new.role           is not distinct from old.role
     and new.clinical_roles is not distinct from old.clinical_roles
     and new.status         is not distinct from old.status then
    return new;
  end if;

  if not public.is_profile_admin(caller) then
    raise exception 'Only an administrator may change role, admin_role, clinical_roles or status'
      using errcode = '42501';
  end if;

  if caller = new.id
     and (new.admin_role         is distinct from old.admin_role
          or new.role           is distinct from old.role
          or new.clinical_roles is distinct from old.clinical_roles) then
    raise exception 'Administrators may not change their own role, admin_role or clinical_roles'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_profile_authz_fields() from public, anon, authenticated;

-- ── 4. Rename a role (and everyone who holds it) ────────────────────────────
create or replace function public.admin_rename_access_role(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_name text;
  clean text := btrim(coalesce(p_name, ''));
begin
  if not public.is_profile_admin(auth.uid()) then
    raise exception 'Only an administrator can rename roles' using errcode = '42501';
  end if;
  if clean = '' then
    raise exception 'Enter a role name' using errcode = '22023';
  end if;
  select name into old_name from public.access_roles where id = p_id and not built_in;
  if old_name is null then
    raise exception 'Built-in roles can''t be renamed' using errcode = '42501';
  end if;
  if exists (select 1 from public.access_roles where lower(name) = lower(clean) and id <> p_id) then
    raise exception 'A role named % already exists', clean using errcode = '23505';
  end if;

  perform set_config('fold.access_role_change', 'on', true);
  update public.profiles
     set clinical_roles = array_replace(clinical_roles, old_name, clean)
   where old_name = any(clinical_roles);
  perform set_config('fold.access_role_change', 'off', true);

  update public.access_roles set name = clean, updated_at = now() where id = p_id;
end;
$$;
revoke all on function public.admin_rename_access_role(uuid, text) from public, anon;
grant execute on function public.admin_rename_access_role(uuid, text) to authenticated;

-- ── 5. Delete a role ────────────────────────────────────────────────────────
-- Refused while anyone has this as their only role (the app says how many);
-- otherwise it comes off everyone who holds it.
create or replace function public.admin_delete_access_role(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
  only_role int;
begin
  if not public.is_profile_admin(auth.uid()) then
    raise exception 'Only an administrator can delete roles' using errcode = '42501';
  end if;
  select name into role_name from public.access_roles where id = p_id and not built_in;
  if role_name is null then
    raise exception 'Built-in roles can''t be deleted' using errcode = '42501';
  end if;
  select count(*) into only_role from public.profiles where clinical_roles = array[role_name];
  if only_role > 0 then
    raise exception '% users have only this role. Give them another role first.', only_role
      using errcode = '23503';
  end if;

  perform set_config('fold.access_role_change', 'on', true);
  update public.profiles
     set clinical_roles = array_remove(clinical_roles, role_name)
   where role_name = any(clinical_roles);
  perform set_config('fold.access_role_change', 'off', true);

  delete from public.access_roles where id = p_id;
end;
$$;
revoke all on function public.admin_delete_access_role(uuid) from public, anon;
grant execute on function public.admin_delete_access_role(uuid) to authenticated;

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select name, built_in, permissions from public.access_roles order by created_at;
--   -- 15 built-in rows, permissions {} (everything allowed)
