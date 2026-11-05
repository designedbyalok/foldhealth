-- Revoke accidental administrator grants on profiles.
--
-- Background: until profiles_signup_role_defaults.sql, handle_new_user() never
-- set admin_role, so every account inherited the column default
-- 'Business/Practice Owner'. That value is an admin marker, the
-- "Admins can update any profile" policy grants UPDATE on EVERY row to anyone
-- whose admin_role is 'Business/Practice Owner' or 'Admin/Practice Manager',
-- or whose clinical_roles contains 'Admin/Practice Manager'.
--
-- Audit of the 35 accounts holding it (2026-08-10) shows the grant was
-- indiscriminate, not deliberate:
--   • 21 @fold.health staff, mostly Viewer / Coder / Support / QA
--   •  7 @astranahealth.com, external customer accounts
--   •  7 personal addresses (gmail / yahoo / outlook / thelanby)
-- Only 4 of them carry an explicit admin marker.
--
-- This migration removes the accidental grants and keeps every deliberate one.
--
-- KEEP 'Business/Practice Owner' where the account is explicitly marked as an
-- administrator (role = 'Admin/Practice Manager' or that value present in
-- clinical_roles). Everyone else drops to 'Employer', the non-admin value
-- already used by 18 rows.
--
-- After this runs the administrator set is unchanged in intent: the same
-- people who were explicitly marked as admins keep access. Only the
-- accidental grants are removed. alokk@fold.health is in the keep set, so
-- there is no lock-out.

begin;

-- Snapshot for rollback. Downgraded rows become indistinguishable from
-- pre-existing 'Employer' rows, so the previous value has to be recorded.
create table if not exists public.profiles_admin_role_backup_20260810 (
  id uuid primary key,
  email text,
  admin_role text,
  backed_up_at timestamptz not null default now()
);

insert into public.profiles_admin_role_backup_20260810 (id, email, admin_role)
select id, email, admin_role
  from public.profiles
 where admin_role = 'Business/Practice Owner'
on conflict (id) do nothing;

update public.profiles
   set admin_role = 'Employer'
 where admin_role = 'Business/Practice Owner'
   and coalesce(role, '') <> 'Admin/Practice Manager'
   and not ('Admin/Practice Manager' = any(coalesce(clinical_roles, array[]::text[])));

commit;

-- ── Verify ────────────────────────────────────────────────────────────────
-- Expected after: 4 owners remain (all explicitly marked admins), and the
-- total admin population is 5 once poojaw@fold.health, already 'Employer'
-- but carrying the clinical admin marker, is counted.
--
-- select email, role, admin_role, clinical_roles
--   from public.profiles
--  where admin_role = 'Business/Practice Owner'
--     or 'Admin/Practice Manager' = any(clinical_roles)
--  order by email;
--
-- Confirm no one lost access unintentionally:
-- select count(*) from public.profiles
--  where admin_role in ('Business/Practice Owner','Admin/Practice Manager')
--     or 'Admin/Practice Manager' = any(clinical_roles);
--
-- ── Rollback ──────────────────────────────────────────────────────────────
-- update public.profiles p
--    set admin_role = b.admin_role
--   from public.profiles_admin_role_backup_20260810 b
--  where b.id = p.id;
-- drop table public.profiles_admin_role_backup_20260810;
