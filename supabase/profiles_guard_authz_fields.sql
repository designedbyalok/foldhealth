-- Make role assignment a database decision instead of a client one.
--
-- THE HOLE THIS CLOSES
-- `profiles` has two UPDATE policies for `authenticated` whose only test is
-- `auth.uid() = id`. They gate WHICH ROW you may write, never WHICH COLUMNS —
-- so any signed-in user could set their own `admin_role`, and `Admins can
-- update any profile` reads `admin_role` back to decide who is an admin. That
-- is a self-service privilege escalation.
--
-- It was not theoretical. PreferencesDrawer loaded `admin_role` into its form
-- with `|| 'Business/Practice Owner'` and spread the whole form back on save,
-- so a user with no admin_role who opened Preferences and pressed Save
-- promoted themselves to the highest privilege. That is the most likely origin
-- of the 36-admin count we cut back to 5 earlier.
--
-- WHAT THIS DOES
--   1. A BEFORE INSERT OR UPDATE trigger on `profiles` that refuses any change
--      to admin_role / role / clinical_roles unless the caller is an admin
--      acting on SOMEBODY ELSE. Self-elevation is denied even for admins.
--   2. `admin_set_user_roles`, the one sanctioned way to assign roles. It is
--      SECURITY DEFINER and re-derives the caller's admin status from the
--      database, so the privilege decision never trusts the browser.
--
-- The trigger is the enforcement; the RPC is the door. Both are needed — the
-- RPC alone would just be another client-chosen path.
--
-- Deliberately NOT changed: the existing RLS policies. They still decide row
-- visibility. This only constrains the three authorization columns.

begin;

-- ── 1. Who counts as an admin ───────────────────────────────────────────────
-- SECURITY DEFINER so it reads `profiles` without tripping RLS recursion when
-- called from a policy or trigger on that same table.
create or replace function public.is_profile_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = uid
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))
  );
$$;

-- ── 2. The guard ────────────────────────────────────────────────────────────
create or replace function public.enforce_profile_authz_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  -- No JWT: service_role, the SQL editor, the handle_new_user() signup trigger,
  -- and the seed scripts. Those are already trusted paths — RLS does not apply
  -- to them either, so guarding here would only break provisioning.
  if caller is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A self-registering user does not get to pick their own privileges. Pin
    -- them to the safe defaults rather than raising, so signup never fails.
    if not public.is_profile_admin(caller) then
      new.admin_role    := 'Employer';
      new.role          := 'Viewer';
      new.clinical_roles := null;
    end if;
    return new;
  end if;

  -- UPDATE: leave ordinary profile edits (name, phone, avatar, …) alone.
  if new.admin_role     is not distinct from old.admin_role
     and new.role       is not distinct from old.role
     and new.clinical_roles is not distinct from old.clinical_roles then
    return new;
  end if;

  if not public.is_profile_admin(caller) then
    raise exception 'Only an administrator may change role, admin_role or clinical_roles'
      using errcode = '42501';
  end if;

  -- An admin may promote others, never themselves. Without this, one
  -- compromised admin session is a permanent lock-in.
  if caller = new.id then
    raise exception 'Administrators may not change their own role, admin_role or clinical_roles'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_authz_fields on public.profiles;
create trigger profiles_guard_authz_fields
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_authz_fields();

-- ── 3. The sanctioned door ──────────────────────────────────────────────────
-- SECURITY DEFINER, so it runs past the trigger — but only after proving the
-- caller is an admin operating on someone else.
create or replace function public.admin_set_user_roles(
  target_id          uuid,
  new_admin_role     text,
  new_role           text,
  new_clinical_roles text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.is_profile_admin(caller) then
    raise exception 'Only an administrator may assign roles' using errcode = '42501';
  end if;
  if caller = target_id then
    raise exception 'Administrators may not assign their own roles' using errcode = '42501';
  end if;
  if new_admin_role not in ('Employer', 'Admin/Practice Manager', 'Business/Practice Owner') then
    raise exception 'Unknown admin_role: %', new_admin_role using errcode = '22023';
  end if;

  update public.profiles
     set admin_role     = new_admin_role,
         role           = coalesce(new_role, 'Viewer'),
         clinical_roles = new_clinical_roles
   where id = target_id;
end;
$$;

revoke all on function public.admin_set_user_roles(uuid, text, text, text[]) from public, anon;
grant execute on function public.admin_set_user_roles(uuid, text, text, text[]) to authenticated;

revoke all on function public.is_profile_admin(uuid) from public, anon;
grant execute on function public.is_profile_admin(uuid) to authenticated;

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Trigger is attached:
--   select tgname from pg_trigger
--    where tgrelid = 'public.profiles'::regclass and not tgisinternal;
--   Expect: profiles_updated_at, profiles_guard_authz_fields
--
-- Admin count must not move (this changes future writes, not existing rows):
--   select count(*) from profiles
--    where admin_role in ('Admin/Practice Manager','Business/Practice Owner');
--
-- Escalation is refused — run as a NON-admin user from the app, not here
-- (the SQL editor has no auth.uid() and is intentionally exempt):
--   update profiles set admin_role = 'Business/Practice Owner' where id = auth.uid();
--   Expect: ERROR 42501 "Only an administrator may change role, ..."
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop trigger if exists profiles_guard_authz_fields on public.profiles;
--   drop function if exists public.enforce_profile_authz_fields();
--   drop function if exists public.admin_set_user_roles(uuid, text, text, text[]);
--   drop function if exists public.is_profile_admin(uuid);
