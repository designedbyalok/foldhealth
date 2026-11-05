-- Security hardening, part 2 (2026-10-22 audit). Safe to re-run.
--
-- 1. RLS back on for hedis_members and apcm_patients. scripts/seed.js used to
--    switch it off on every seed, which left both PHI tables open to the anon
--    key. Their "authenticated only" policies already exist.
-- 2. profiles.status is an authorization field: only an admin may change it,
--    and a self-created profile row starts as Pending. Before this, a
--    deactivated user could set their own status back to 'Active'.
-- 3. Only an Active admin counts as an admin.
-- 4. Deactivated (Inactive / Suspended) accounts get no token, at sign-in or
--    at refresh, so their open sessions end within the hour.
-- 5. Policies that applied to PUBLIC (anon included) narrowed to authenticated.
-- 6. auth.uid() wrapped in (select …) so it runs once per query, not per row.
-- 7. Indexes on foreign keys used for cascades and lookups.

begin;

-- ── 1 ───────────────────────────────────────────────────────────────────────
alter table if exists public.hedis_members enable row level security;
alter table if exists public.apcm_patients enable row level security;
do $$
declare t text;
begin
  foreach t in array array['hedis_members', 'apcm_patients'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format('create policy "Allow all" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- ── 3 ───────────────────────────────────────────────────────────────────────
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
       and coalesce(p.status, 'Active') = 'Active'
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))
  );
$$;
revoke all on function public.is_profile_admin(uuid) from public, anon, authenticated;

-- ── 2 ───────────────────────────────────────────────────────────────────────
create or replace function public.enforce_profile_authz_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  -- No JWT: service_role, the SQL editor, the handle_new_user() signup trigger
  -- and the seed scripts. Trusted paths that RLS doesn't apply to either.
  if caller is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A self-registering user does not pick their own privileges or approve
    -- themselves. Pin safe defaults rather than raising, so signup never fails.
    if not public.is_profile_admin(caller) then
      new.admin_role     := 'Employer';
      new.role           := 'Viewer';
      new.clinical_roles := null;
      new.status         := 'Pending';
    end if;
    return new;
  end if;

  -- UPDATE: leave ordinary profile edits (name, phone, avatar, …) alone.
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

  -- An admin may promote others, never themselves. Without this, one
  -- compromised admin session is a permanent lock-in.
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

-- ── 4 ───────────────────────────────────────────────────────────────────────
-- As in account_unlock_link_migration.sql, plus the Inactive / Suspended branch.
create or replace function public.signup_approval_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  account_status text;
  is_locked boolean := false;
  needs_reset boolean := false;
begin
  select status into account_status
    from public.profiles
   where id = (event->>'user_id')::uuid;

  if account_status = 'Pending' then
    if event->>'authentication_method' in ('email/signup', 'otp', 'magiclink', 'oauth') then
      return jsonb_set(
        event,
        '{claims}',
        (event->'claims') || jsonb_build_object('role', 'anon', 'approval_status', 'pending')
      );
    end if;
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Your account is awaiting admin approval. You can sign in once an administrator approves your request.'
    ));
  elsif account_status = 'Rejected' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Your sign-up request was not approved. Contact your administrator for access.'
    ));
  elsif account_status in ('Inactive', 'Suspended') then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Your account is not active. Contact your administrator for access.'
    ));
  end if;

  if event->>'authentication_method' = 'password' then
    select locked_at is not null, coalesce(require_reset, false)
      into is_locked, needs_reset
      from public.account_lockouts
     where user_id = (event->>'user_id')::uuid;
    if coalesce(is_locked, false) then
      return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'ACCOUNT_PAUSED'));
    elsif coalesce(needs_reset, false) then
      return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'PASSWORD_RESET_REQUIRED'));
    end if;
  end if;

  return event;
end;
$$;
grant execute on function public.signup_approval_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.signup_approval_access_token_hook(jsonb) from public, anon, authenticated;

-- ── 5 ───────────────────────────────────────────────────────────────────────
-- A Pending user's token has role anon but a real `sub`, so
-- "auth.uid() is not null" alone doesn't keep them out.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'patient_program_activity'
             and policyname = 'Allow all patient_program_activity') then
    alter policy "Allow all patient_program_activity" on public.patient_program_activity to authenticated;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pop_group_rule_templates'
             and policyname = 'Allow all') then
    alter policy "Allow all" on public.pop_group_rule_templates to authenticated;
  end if;
end $$;

-- ── 6 ───────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.notifications') is not null then
    alter policy notifications_select_own on public.notifications
      using (recipient_id = (select auth.uid()));
    alter policy notifications_update_own on public.notifications
      using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
    alter policy notifications_delete_own on public.notifications
      using (recipient_id = (select auth.uid()));
  end if;

  if to_regclass('public.hcc_diag_seen') is not null then
    alter policy hcc_diag_seen_select_own on public.hcc_diag_seen using (user_id = (select auth.uid()));
    alter policy hcc_diag_seen_insert_own on public.hcc_diag_seen with check (user_id = (select auth.uid()));
    alter policy hcc_diag_seen_update_own on public.hcc_diag_seen
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.care_plan_note_reads') is not null then
    alter policy "Own care_plan_note_reads" on public.care_plan_note_reads
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.user_worklist_column_prefs') is not null then
    alter policy "read own column prefs" on public.user_worklist_column_prefs
      to authenticated using ((select auth.uid()) = user_id);
    alter policy "insert own column prefs" on public.user_worklist_column_prefs
      to authenticated with check ((select auth.uid()) = user_id);
    alter policy "update own column prefs" on public.user_worklist_column_prefs
      to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    alter policy "delete own column prefs" on public.user_worklist_column_prefs
      to authenticated using ((select auth.uid()) = user_id);
  end if;

  if to_regclass('public.jsa_members') is not null then
    alter policy jsa_members_insert on public.jsa_members
      with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'Active'));
    alter policy jsa_members_update on public.jsa_members
      using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'Active'))
      with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'Active'));
    alter policy jsa_members_delete on public.jsa_members
      using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'Active'));
  end if;
end $$;

-- ── 7 ───────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.notifications') is not null then
    create index if not exists notifications_task_idx on public.notifications(task_id);
  end if;
  if to_regclass('public.tasks') is not null then
    create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to_id);
    create index if not exists tasks_created_by_idx on public.tasks(created_by_id);
  end if;
  if to_regclass('public.patient_care_plan_interventions') is not null then
    create index if not exists pcp_interventions_goal_idx on public.patient_care_plan_interventions(goal_id);
  end if;
  if to_regclass('public.clinical_notes') is not null then
    create index if not exists clinical_notes_author_idx on public.clinical_notes(author_id);
    create index if not exists clinical_notes_reviewer_idx on public.clinical_notes(reviewer_id);
  end if;
end $$;

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select relname, relrowsecurity from pg_class
--    where relname in ('hedis_members', 'apcm_patients');           -- both true
--   select policyname, roles from pg_policies
--    where tablename in ('patient_program_activity', 'pop_group_rule_templates');
--                                                                   -- {authenticated}
