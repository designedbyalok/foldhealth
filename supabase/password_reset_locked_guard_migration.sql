-- Locked-account guard for self-service password reset ──────────────────────
-- The forgot-password flow now uses Supabase's own recovery email
-- (resetPasswordForEmail → recovery.html → ResetPasswordPage). That path is
-- reachable by anyone with the account's mailbox, including an account that is
-- locked and still waiting for a practice admin to unlock it.
--
-- on_auth_password_changed previously cleared the lock on ANY password change,
-- so a locked user could self-reset and get back in, bypassing the
-- admin-unlock requirement. This replaces that function so a HARD lock
-- (locked_at set, not yet admin-unlocked) is NOT cleared by a self-service
-- reset: the password is changed and every session ended, but the account
-- stays ACCOUNT_PAUSED at sign-in until a practice admin unlocks it.
--
-- Exceptions that still clear the lock on password change (unchanged):
--   • require_reset = true: the admin already unlocked and the user is
--     setting a new password from the emailed unlock link (sanctioned path).
--   • the user is a practice admin, so admins can always self-recover and
--     can't all be stranded locked out.
--
-- Everything else about the function (password history, sign-out, audit, and
-- the emails: none while the account is still Pending, "account activated"
-- after an administrator unlock, otherwise "password changed") is unchanged
-- from account_email_templates_migration.sql, its latest definition.

create or replace function public.on_auth_password_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_locked boolean := false;
  was_waiting boolean := false;
  keep_lock boolean := false;
  is_invite boolean := coalesce(old.raw_user_meta_data->>'invited', '') = 'true';
  display text;
  account_status text;
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

  select locked_at is not null, require_reset into was_locked, was_waiting
    from public.account_lockouts where user_id = new.id;

  -- A hard lock (awaiting an administrator, not an admin-issued "set a new
  -- password" state) is NOT cleared by a self-service reset. Admins are exempt
  -- so they can always recover their own access.
  keep_lock := coalesce(was_locked, false)
               and not coalesce(was_waiting, false)
               and not public.is_profile_admin(new.id);

  if not keep_lock then
    update public.account_lockouts
       set failed_count = 0, first_failed_at = null, failed_apps = '{}', require_reset = false,
           locked_at = null, updated_at = now()
     where user_id = new.id;
  end if;

  insert into public.account_lock_events (user_id, event, actor_name, detail)
  values (new.id, 'password_changed', 'user',
          jsonb_build_object('was_locked', coalesce(was_locked, false), 'lock_kept', keep_lock));

  delete from auth.sessions where user_id = new.id;

  select coalesce(nullif(trim(full_name), ''), new.email), status into display, account_status
    from public.profiles where id = new.id;
  perform public.account_security_audit(new.id, 'Password changed',
    case when keep_lock then 'Password changed, but the account stays locked until a practice administrator unlocks it. Signed out of all sessions.'
         when coalesce(was_waiting, false) then 'New password set after an administrator unlocked the account. Signed out of all sessions.'
         else 'Password changed. Signed out of all sessions.' end,
    coalesce(display, new.email));

  if account_status is distinct from 'Pending' then
    insert into public.security_email_outbox (kind, user_id, to_email, payload)
    values (case when coalesce(was_waiting, false) then 'account_activated' else 'password_changed' end,
            new.id, new.email,
            jsonb_build_object('name', coalesce(display, new.email), 'email', new.email, 'at', now()));
    perform public.security_email_kick();
  end if;
  return new;
exception when others then
  raise warning 'password change bookkeeping skipped: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function public.on_auth_password_changed() from public, anon, authenticated;
