-- Staff-only gate on every table, so patient accounts can share this project.
--
-- BEFORE
-- Nearly every policy in `public` reads `auth.uid() is not null` or `true` for
-- the `authenticated` role. That was fine while every account was staff. The
-- patient app (patients.foldhealth.org) signs patients into this same project,
-- and the moment one exists it could read every patient's chart.
--
-- AFTER
--   1. Each account carries `raw_app_meta_data.role` = 'staff' | 'patient'.
--      app_metadata is writable only with the service role, so a user cannot
--      promote themselves. Every existing account is backfilled to 'staff'.
--   2. New accounts default to 'staff' unless the server created them as
--      'patient' (the patient app creates accounts server-side only). Staff
--      self-signups still land as Pending and are refused a session by
--      signup_approval_access_token_hook, exactly as before.
--   3. handle_new_user() gives patients no staff profile and sends no
--      "awaiting approval" notification.
--   4. public.is_staff() reads the role from auth.users, not the JWT, so it
--      applies immediately (no wait for token refresh) and can be revoked live.
--   5. Every public table gets a RESTRICTIVE policy `staff_only`. Restrictive
--      policies are ANDed with the existing permissive ones, so no existing
--      policy is rewritten and staff see exactly what they saw before.
--      A table patients may read later replaces its `staff_only` with
--      `is_staff() OR <patient condition>`.
--   6. An event trigger adds `staff_only` to every table created from now on,
--      so a new migration cannot forget it.
--   7. storage.objects gets the same gate.
--
-- `anon`, `service_role` and `supabase_auth_admin` are untouched: the
-- restrictive policies apply to `authenticated` only.

begin;

-- ── 1. Role check ───────────────────────────────────────────────────────────
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.raw_app_meta_data->>'role' = 'staff'
       from auth.users u
      where u.id = auth.uid()),
    false
  );
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ── 2. Backfill + default for new accounts ──────────────────────────────────
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"staff"}'
 where raw_app_meta_data->>'role' is null;

create or replace function public.assign_default_app_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data->>'role' is null then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"role":"staff"}';
  end if;
  return new;
end;
$$;
revoke execute on function public.assign_default_app_role() from public, anon, authenticated;

drop trigger if exists assign_default_app_role on auth.users;
create trigger assign_default_app_role
  before insert on auth.users
  for each row execute function public.assign_default_app_role();

-- ── 3. Patients get no staff profile ────────────────────────────────────────
-- Identical to the current definition apart from the early return.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
DECLARE
  was_invited boolean;
  new_status  text;
  display     text;
BEGIN
  IF NEW.raw_app_meta_data->>'role' = 'patient' THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.signup_invites WHERE email = lower(NEW.email);
  was_invited := FOUND;
  new_status  := CASE WHEN was_invited THEN 'Invited' ELSE 'Pending' END;

  display := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(TRIM(
      COALESCE(NEW.raw_user_meta_data->>'first_name', '') ||
      ' ' ||
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    ), '')
  );

  INSERT INTO public.profiles (
    id, email, full_name, status, role, admin_role, created_at, last_active_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    display,
    new_status,
    'Viewer',
    'Employer',
    NEW.created_at,
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO NOTHING;

  IF new_status = 'Pending' THEN
    BEGIN
      INSERT INTO public.notifications
        (recipient_id, actor_id, actor_name, type, title, body, action)
      SELECT p.id, NEW.id, COALESCE(display, NEW.email), 'user.signup_requested',
             'New sign-up awaiting approval',
             NEW.email || ' signed up and is waiting for approval.',
             'openPendingUsers'
        FROM public.profiles p
       WHERE p.status = 'Active'
         AND (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
              OR 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'signup approval notification skipped: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 4. staff_only on every existing table ───────────────────────────────────
-- `(select ...)` makes Postgres evaluate is_staff() once per statement, not per row.
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('drop policy if exists staff_only on public.%I', t.relname);
    execute format(
      'create policy staff_only on public.%I as restrictive for all to authenticated
         using ((select public.is_staff())) with check ((select public.is_staff()))',
      t.relname);
  end loop;
end;
$$;

-- ── 5. ...and on every table created later ──────────────────────────────────
create or replace function public.add_staff_only_policy()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
     where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
       and object_type = 'table'
       and schema_name = 'public'
  loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public'
         and tablename = (parse_ident(obj.object_identity))[2]
         and policyname = 'staff_only'
    ) then
      execute format(
        'create policy staff_only on %s as restrictive for all to authenticated
           using ((select public.is_staff())) with check ((select public.is_staff()))',
        obj.object_identity);
    end if;
  end loop;
end;
$$;
revoke execute on function public.add_staff_only_policy() from public, anon, authenticated;

drop event trigger if exists add_staff_only_policy;
create event trigger add_staff_only_policy
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.add_staff_only_policy();

-- ── 6. Storage ──────────────────────────────────────────────────────────────
drop policy if exists staff_only on storage.objects;
create policy staff_only on storage.objects as restrictive for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select raw_app_meta_data->>'role' role, count(*) from auth.users group by 1;
--   -- every public table should appear; expect zero rows:
--   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind in ('r','p')
--      and not exists (select 1 from pg_policies p where p.schemaname = 'public'
--                        and p.tablename = c.relname and p.policyname = 'staff_only');
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop event trigger if exists add_staff_only_policy;
--   drop function if exists public.add_staff_only_policy();
--   drop policy if exists staff_only on storage.objects;
--   do $$ declare t record; begin
--     for t in select tablename from pg_policies
--               where schemaname = 'public' and policyname = 'staff_only'
--     loop execute format('drop policy staff_only on public.%I', t.tablename); end loop;
--   end $$;
--   drop trigger if exists assign_default_app_role on auth.users;
--   drop function if exists public.assign_default_app_role();
--   -- restore handle_new_user() from signup_approval_migration.sql
--   -- the backfilled `role` key in app_metadata is harmless to leave in place
