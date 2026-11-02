-- Admins could not edit other users' profiles (approve a pending sign-up,
-- change status or roles): "infinite recursion detected in policy for
-- relation profiles".
--
-- BEFORE
-- "Admins can update any profile" decided who is an admin with an inline
-- subquery on public.profiles. Postgres only rejects a policy that reads its
-- own table when expanding that inner read brings in a policy that itself
-- contains a subquery. That started when the patient app staff gate added the
-- RESTRICTIVE staff_only policy, USING ((select is_staff())), to every table
-- including profiles, so every admin UPDATE of another user's row failed.
-- Updating your own profile was unaffected (a different policy).
--
-- AFTER
-- The policy asks current_user_is_profile_admin(), a SECURITY DEFINER
-- function, so the policy no longer reads profiles. The function only answers
-- for the signed-in user (unlike is_profile_admin(uuid), which stays locked
-- down) and follows is_profile_admin: only an Active admin counts.
--
-- Idempotent. No data changes.

begin;

create or replace function public.current_user_is_profile_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_profile_admin(auth.uid());
$$;
revoke all on function public.current_user_is_profile_admin() from public, anon;
grant execute on function public.current_user_is_profile_admin() to authenticated;

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile" on public.profiles
  for update to authenticated
  using ((select public.current_user_is_profile_admin()))
  with check ((select public.current_user_is_profile_admin()));

commit;

-- ── Verify ─────────────────────────────────────────────────────────────────
-- As an Active admin (request.jwt.claims sub = admin id, role authenticated):
--   update public.profiles set status = status where id = '<another user>';
-- Expect 1 row, no "infinite recursion" error. As a non-admin: 0 rows.
--
-- ── Rollback ───────────────────────────────────────────────────────────────
--   drop policy if exists "Admins can update any profile" on public.profiles;
--   create policy "Admins can update any profile" on public.profiles
--     for update to authenticated
--     using (exists (select 1 from public.profiles admin_p
--                     where admin_p.id = auth.uid()
--                       and (admin_p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
--                            or 'Admin/Practice Manager' = any(admin_p.clinical_roles))))
--     with check (exists (select 1 from public.profiles admin_p
--                     where admin_p.id = auth.uid()
--                       and (admin_p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
--                            or 'Admin/Practice Manager' = any(admin_p.clinical_roles))));
--   drop function if exists public.current_user_is_profile_admin();
