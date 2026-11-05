-- New signups must not land with administrative privileges.
--
-- Problem (verified against production 2026-08-10):
--   handle_new_user() inserts only (id, email, full_name, status, created_at,
--   last_active_at), so `admin_role` fell through to its column default,
--   which was 'Business/Practice Owner'. That value IS the admin marker: the
--   "Admins can update any profile" policy grants UPDATE on EVERY row to
--   anyone holding it (see UsersTab.jsx:141, isSystemAdmin). Every account
--   created through normal signup therefore became a system administrator.
--
-- Fix: default new profiles to the non-administrative pair already in use
-- elsewhere in the data, role 'Viewer', admin_role 'Employer', and have the
-- signup trigger set both explicitly instead of relying on column defaults.
--
-- Deliberately NOT changed: the 35 existing rows holding
-- 'Business/Practice Owner'. Some of those are legitimate administrators and
-- blanket-downgrading them could lock the organisation out of user
-- management. Auditing who should keep it is a separate, human decision,
-- see the query at the bottom.
--
-- Verified safe: profiles has no CHECK constraint on `role` or `admin_role`
-- (only `profiles_status_check` on `status`), and both target values already
-- occur in the table ('Employer' x18, 'Viewer' x28).

begin;

-- 1. Column defaults. `role` is already 'Viewer'; restated so the intended
--    pairing is visible in one place and survives future edits.
alter table public.profiles alter column role       set default 'Viewer';
alter table public.profiles alter column admin_role set default 'Employer';

-- 2. Make the signup trigger assert both roles rather than inheriting them.
--    Body is otherwise byte-for-byte the existing function: SECURITY DEFINER,
--    the same search_path, the same full_name coalesce, the same invited ->
--    'Invited' status mapping, and ON CONFLICT (id) DO NOTHING so an existing
--    row is never overwritten.
--
--    Invited users are unaffected in practice: AccountPanel updates the
--    profile with the intended role right after signUp() returns.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, status, role, admin_role, created_at, last_active_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NULLIF(TRIM(
        COALESCE(NEW.raw_user_meta_data->>'first_name', '') ||
        ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
      ), '')
    ),
    CASE
      WHEN NEW.raw_user_meta_data->>'invited' = 'true' THEN 'Invited'
      ELSE 'Active'
    END,
    'Viewer',     -- never inherit a privileged default
    'Employer',   -- non-administrative
    NEW.created_at,
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

commit;

-- ── Verify ────────────────────────────────────────────────────────────────
-- select column_name, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='profiles'
--    and column_name in ('role','admin_role');
-- Expected: 'Viewer'::text and 'Employer'::text
--
-- ── Audit the pre-existing administrators (no changes made to them) ───────
-- select id, email, full_name, role, admin_role, clinical_roles, created_at
--   from public.profiles
--  where admin_role = 'Business/Practice Owner'
--     or 'Admin/Practice Manager' = any(clinical_roles)
--  order by created_at;
--
-- ── Rollback ─────────────────────────────────────────────────────────────
-- The previous defaults were role 'Viewer' and admin_role
-- 'Business/Practice Owner'; the previous trigger body omitted role and
-- admin_role from the INSERT column list entirely.
