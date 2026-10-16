-- Account lockout (HITRUST): five consecutive failed password attempts lock
-- the account until a person acts. No timer unlocks it. Two ways back in:
--   1. Forgot password: a 6-digit emailed code (api/password-reset.js), then
--      a new password. Changing the password clears the lock.
--   2. An admin unlocks it from Settings → Users, with a recorded reason
--      (admin_unlock_account below).
-- The failure count resets only on a successful sign-in, a completed
-- password change, or an admin unlock.
--
-- Pieces:
--   • account_lockouts            per-user count and lock state (admins read)
--   • account_lock_events         history: locked / unlocked / password_changed
--   • password_reset_codes        hashed 6-digit codes (service role only)
--   • password_history            previous password hashes (service role only)
--   • security_email_outbox       security emails waiting to be sent by
--                                 api/security-email-dispatch.js (service role only)
--   • hook_password_verification_attempt   Supabase Password Verification Hook
--   • on_auth_password_changed    trigger on auth.users: clears the lock,
--                                 keeps history, ends sessions, queues email
--   • admin_unlock_account        admin-only unlock RPC
--
-- AFTER RUNNING THIS MIGRATION (Supabase Dashboard):
--   Authentication → Hooks → "Password Verification Attempt" → Postgres →
--   public.hook_password_verification_attempt. (Team/Enterprise plan.)
--   Optional instant email: insert the dispatch URL and secret, e.g.
--     insert into public.security_settings (key, value) values
--       ('email_dispatch_url', 'https://<app>/api/security-email-dispatch'),
--       ('email_dispatch_secret', '<same as SECURITY_DISPATCH_SECRET>');
--   (needs the pg_net extension). Without it the app flushes the outbox
--   itself after a lock, unlock or reset.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.account_lockouts (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  failed_count      int  not null default 0,
  first_failed_at   timestamptz,
  last_failed_at    timestamptz,
  locked_at         timestamptz,                 -- null = not locked
  locked_by         text,                        -- 'system'
  failed_apps       text[] not null default '{}',
  last_ip           text,                        -- not available to the hook today
  require_reset     boolean not null default false,
  unlocked_at       timestamptz,
  unlocked_by       uuid,
  unlocked_by_name  text,
  unlock_reason     text,                        -- phone | in_person | suspected_attack | other | password_reset
  unlock_note       text,
  updated_at        timestamptz not null default now()
);

create table if not exists public.account_lock_events (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  event       text not null,                     -- locked | unlocked | password_changed
  actor_id    uuid,
  actor_name  text,
  reason      text,
  note        text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists account_lock_events_user_idx on public.account_lock_events (user_id, created_at desc);

create table if not exists public.password_reset_codes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      int not null default 0,
  used_at       timestamptz,
  requested_by  uuid,                            -- admin who sent it, if any
  created_at    timestamptz not null default now()
);
create index if not exists password_reset_codes_user_idx on public.password_reset_codes (user_id, created_at desc);

create table if not exists public.password_history (
  id             bigserial primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  password_hash  text not null,
  created_at     timestamptz not null default now()
);
create index if not exists password_history_user_idx on public.password_history (user_id, created_at desc);

create table if not exists public.security_email_outbox (
  id          bigserial primary key,
  kind        text not null,                     -- account_locked | account_unlocked | password_changed | staff_account_locked
  user_id     uuid,                              -- the account the email is about
  to_email    text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending',   -- pending | sent | failed
  attempts    int not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists security_email_outbox_pending_idx on public.security_email_outbox (status, created_at);

create table if not exists public.security_settings (
  key    text primary key,
  value  text not null
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Lock state and history: admins read. All writes go through the security
-- definer functions below, never the client.
alter table public.account_lockouts      enable row level security;
alter table public.account_lock_events   enable row level security;
alter table public.password_reset_codes  enable row level security;
alter table public.password_history      enable row level security;
alter table public.security_email_outbox enable row level security;
alter table public.security_settings     enable row level security;

drop policy if exists "Admins read account lockouts" on public.account_lockouts;
create policy "Admins read account lockouts" on public.account_lockouts
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.status = 'Active'
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))
  ));

drop policy if exists "Admins read account lock events" on public.account_lock_events;
create policy "Admins read account lock events" on public.account_lock_events
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.status = 'Active'
       and (p.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(p.clinical_roles, '{}')))
  ));
-- password_reset_codes, password_history, security_email_outbox and
-- security_settings have no policies: only the service role reaches them.

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Asks api/security-email-dispatch.js to send queued emails now, when the
-- URL is configured and pg_net is installed. Never fails the caller.
create or replace function public.security_email_kick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dispatch_url text;
  dispatch_secret text;
begin
  select value into dispatch_url from public.security_settings where key = 'email_dispatch_url';
  if dispatch_url is null then return; end if;
  select value into dispatch_secret from public.security_settings where key = 'email_dispatch_secret';
  begin
    perform net.http_post(
      url := dispatch_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', coalesce(dispatch_secret, '')),
      body := '{}'::jsonb
    );
  exception when others then
    raise warning 'security email kick skipped: %', sqlerrm;
  end;
end;
$$;

-- Queue the "account locked" emails and admin notifications. Errors here
-- must never change the sign-in decision.
create or replace function public.account_lock_alert(target uuid, attempts int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
  target_name text;
begin
  select u.email, coalesce(nullif(trim(p.full_name), ''), u.email)
    into target_email, target_name
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = target;

  insert into public.security_email_outbox (kind, user_id, to_email, payload)
  values ('account_locked', target, target_email,
          jsonb_build_object('name', target_name, 'attempts', attempts, 'at', now()));

  -- Practice admins: an in-app notification and an email.
  insert into public.notifications (recipient_id, actor_id, actor_name, type, title, body, action)
  select a.id, target, target_name, 'user.locked', 'Staff account locked',
         target_name || ' was locked after ' || attempts || ' failed sign-in attempts.',
         'openLockedUsers'
    from public.profiles a
   where a.status = 'Active' and a.id <> target
     and (a.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
          or 'Admin/Practice Manager' = any(coalesce(a.clinical_roles, '{}')));

  insert into public.security_email_outbox (kind, user_id, to_email, payload)
  select 'staff_account_locked', target, a.email,
         jsonb_build_object('name', target_name, 'email', target_email, 'attempts', attempts, 'at', now())
    from public.profiles a
   where a.status = 'Active' and a.id <> target and a.email is not null
     and (a.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
          or 'Admin/Practice Manager' = any(coalesce(a.clinical_roles, '{}')));

  perform public.security_email_kick();
exception when others then
  raise warning 'account lock alert skipped: %', sqlerrm;
end;
$$;

-- ── Password Verification Hook ──────────────────────────────────────────────
-- Called by Supabase Auth on every password sign-in with { user_id, valid }.
-- 'reject' carries a code the sign-in screen recognises:
--   ACCOUNT_PAUSED          locked (5th failure, or any attempt while locked)
--   PASSWORD_RESET_REQUIRED an admin unlocked it but required a new password
-- The screen never says "locked"; the detail is in the email.
-- Sessions already signed in are left alone (should_logout_user false).
create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (event->>'user_id')::uuid;
  is_valid boolean := coalesce((event->>'valid')::boolean, false);
  rec public.account_lockouts;
  max_attempts constant int := 5;
begin
  insert into public.account_lockouts (user_id) values (uid) on conflict (user_id) do nothing;
  select * into rec from public.account_lockouts where user_id = uid for update;

  if rec.locked_at is not null then
    if not is_valid then
      update public.account_lockouts
         set failed_count = failed_count + 1, last_failed_at = now(), updated_at = now()
       where user_id = uid;
    end if;
    return jsonb_build_object('decision', 'reject', 'message', 'ACCOUNT_PAUSED', 'should_logout_user', false);
  end if;

  if is_valid then
    if rec.require_reset then
      return jsonb_build_object('decision', 'reject', 'message', 'PASSWORD_RESET_REQUIRED', 'should_logout_user', false);
    end if;
    if rec.failed_count > 0 then
      update public.account_lockouts
         set failed_count = 0, first_failed_at = null, failed_apps = '{}', updated_at = now()
       where user_id = uid;
    end if;
    return jsonb_build_object('decision', 'continue');
  end if;

  update public.account_lockouts
     set failed_count    = failed_count + 1,
         first_failed_at = coalesce(first_failed_at, now()),
         last_failed_at  = now(),
         failed_apps     = case when 'Web' = any(failed_apps) then failed_apps else failed_apps || 'Web' end,
         updated_at      = now()
   where user_id = uid
  returning * into rec;

  if rec.failed_count >= max_attempts then
    update public.account_lockouts
       set locked_at = now(), locked_by = 'system',
           unlocked_at = null, unlocked_by = null, unlocked_by_name = null, unlock_reason = null, unlock_note = null,
           updated_at = now()
     where user_id = uid;
    insert into public.account_lock_events (user_id, event, actor_name, detail)
    values (uid, 'locked', 'system', jsonb_build_object('attempts', rec.failed_count, 'apps', rec.failed_apps));
    perform public.account_lock_alert(uid, rec.failed_count);
    return jsonb_build_object('decision', 'reject', 'message', 'ACCOUNT_PAUSED', 'should_logout_user', false);
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
revoke execute on function public.account_lock_alert(uuid, int) from public, anon, authenticated;
revoke execute on function public.security_email_kick() from public, anon, authenticated;

-- ── Password changed (any path) ─────────────────────────────────────────────
-- Forgot password, an admin-required reset, or a change in the app: clear the
-- lock, keep the old hash for the reuse check, end every session and queue
-- the "Password changed" email (plus "Account unlocked" if it was locked).
-- Accepting an invite sets the first real password, so it's skipped.
create or replace function public.on_auth_password_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_locked boolean := false;
  is_invite boolean := coalesce(old.raw_user_meta_data->>'invited', '') = 'true';
  display text;
begin
  if new.encrypted_password is not distinct from old.encrypted_password then
    return new;
  end if;
  if is_invite then
    return new;
  end if;

  if coalesce(old.encrypted_password, '') <> '' then
    insert into public.password_history (user_id, password_hash) values (new.id, old.encrypted_password);
    delete from public.password_history
     where user_id = new.id
       and id not in (select id from public.password_history where user_id = new.id order by created_at desc limit 5);
  end if;

  select locked_at is not null into was_locked from public.account_lockouts where user_id = new.id;
  update public.account_lockouts
     set failed_count = 0, first_failed_at = null, failed_apps = '{}', require_reset = false,
         locked_at = null,
         unlocked_at      = case when locked_at is not null then now() else unlocked_at end,
         unlocked_by      = case when locked_at is not null then null else unlocked_by end,
         unlocked_by_name = case when locked_at is not null then null else unlocked_by_name end,
         unlock_reason    = case when locked_at is not null then 'password_reset' else unlock_reason end,
         unlock_note      = case when locked_at is not null then null else unlock_note end,
         updated_at = now()
   where user_id = new.id;

  insert into public.account_lock_events (user_id, event, actor_name, detail)
  values (new.id, 'password_changed', 'user', jsonb_build_object('was_locked', coalesce(was_locked, false)));

  -- Sessions end everywhere when the password changes.
  delete from auth.sessions where user_id = new.id;

  select coalesce(nullif(trim(full_name), ''), new.email) into display from public.profiles where id = new.id;
  insert into public.security_email_outbox (kind, user_id, to_email, payload)
  values ('password_changed', new.id, new.email, jsonb_build_object('name', coalesce(display, new.email), 'at', now()));
  if coalesce(was_locked, false) then
    insert into public.security_email_outbox (kind, user_id, to_email, payload)
    values ('account_unlocked', new.id, new.email,
            jsonb_build_object('name', coalesce(display, new.email), 'at', now(), 'via', 'password_reset'));
  end if;
  perform public.security_email_kick();
  return new;
exception when others then
  -- A bookkeeping problem must never block a password change.
  raise warning 'password change bookkeeping skipped: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_password_changed on auth.users;
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.on_auth_password_changed();
revoke execute on function public.on_auth_password_changed() from public, anon, authenticated;

-- ── Reuse check for the reset API (service role) ────────────────────────────
-- True when `candidate` matches the current password or one of the last five.
create or replace function public.password_matches_recent(target uuid, candidate text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from (
      select encrypted_password as h from auth.users where id = target
      union all
      select password_hash from (
        select password_hash from public.password_history
         where user_id = target order by created_at desc limit 5
      ) recent
    ) hashes
    where coalesce(h, '') <> '' and extensions.crypt(candidate, h) = h
  );
$$;
revoke execute on function public.password_matches_recent(uuid, text) from public, anon, authenticated;
grant execute on function public.password_matches_recent(uuid, text) to service_role;

-- ── Admin unlock ────────────────────────────────────────────────────────────
-- The Unlock permission: practice admins (is_profile_admin). Reason is one of
-- phone | in_person | suspected_attack | other; identity must be confirmed.
-- A suspected attack always requires a new password (and ends sessions).
create or replace function public.admin_unlock_account(
  target uuid,
  reason text,
  note text default null,
  identity_confirmed boolean default false,
  require_reset boolean default false
)
returns public.account_lockouts
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_name text;
  target_email text;
  target_name text;
  force_reset boolean := coalesce(require_reset, false) or reason = 'suspected_attack';
  result public.account_lockouts;
begin
  if caller is null or not public.is_profile_admin(caller) then
    raise exception 'Only practice admins can unlock accounts' using errcode = '42501';
  end if;
  if reason not in ('phone', 'in_person', 'suspected_attack', 'other') then
    raise exception 'Choose a reason for unlocking' using errcode = '22023';
  end if;
  if not coalesce(identity_confirmed, false) then
    raise exception 'Confirm that you checked the user''s identity' using errcode = '22023';
  end if;
  if reason = 'other' and coalesce(trim(note), '') = '' then
    raise exception 'Add a note for "Other"' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(full_name), ''), email) into caller_name from public.profiles where id = caller;
  select u.email, coalesce(nullif(trim(p.full_name), ''), u.email)
    into target_email, target_name
    from auth.users u left join public.profiles p on p.id = u.id where u.id = target;

  insert into public.account_lockouts (user_id) values (target) on conflict (user_id) do nothing;
  update public.account_lockouts
     set locked_at = null, failed_count = 0, first_failed_at = null, failed_apps = '{}',
         require_reset = force_reset,
         unlocked_at = now(), unlocked_by = caller, unlocked_by_name = caller_name,
         unlock_reason = reason, unlock_note = nullif(trim(note), ''),
         updated_at = now()
   where user_id = target
  returning * into result;

  if force_reset then
    delete from auth.sessions where user_id = target;
  end if;

  insert into public.account_lock_events (user_id, event, actor_id, actor_name, reason, note, detail)
  values (target, 'unlocked', caller, caller_name, reason, nullif(trim(note), ''),
          jsonb_build_object('require_reset', force_reset));

  insert into public.audit_logs (entity_type, entity_id, entity_name, action, user_name, details, category)
  values ('UserProfile', target::text, target_name, 'Account unlocked', caller_name,
          'Reason: ' || reason || coalesce(' (' || nullif(trim(note), '') || ')', '')
            || case when force_reset then '. Password reset required.' else '' end,
          'Security');

  insert into public.security_email_outbox (kind, user_id, to_email, payload)
  values ('account_unlocked', target, target_email,
          jsonb_build_object('name', target_name, 'at', now(), 'via', 'admin', 'require_reset', force_reset));
  perform public.security_email_kick();

  return result;
end;
$$;
revoke execute on function public.admin_unlock_account(uuid, text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_unlock_account(uuid, text, text, boolean, boolean) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   Disable the hook in the Dashboard first, then:
--   drop trigger if exists on_auth_password_changed on auth.users;
--   drop function if exists public.on_auth_password_changed();
--   drop function if exists public.hook_password_verification_attempt(jsonb);
--   drop function if exists public.admin_unlock_account(uuid, text, text, boolean, boolean);
--   drop function if exists public.password_matches_recent(uuid, text);
--   drop function if exists public.account_lock_alert(uuid, int);
--   drop function if exists public.security_email_kick();
--   drop table if exists public.security_email_outbox, public.password_history,
--     public.password_reset_codes, public.account_lock_events,
--     public.account_lockouts, public.security_settings;
