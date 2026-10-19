-- Users got the same security email two or three times, and self sign-ups
-- got a "Your password was changed" email they never asked for.
--
-- 1. Duplicate sends. Three things flush public.security_email_outbox at
--    once: the database (security_email_kick via pg_net), the sign-in page
--    (/api/security-email-dispatch) and the reset API. Each one read every
--    'pending' row and sent it before marking it 'sent', so overlapping
--    flushes sent the same row more than once. claim_security_emails() now
--    hands each row to exactly one flusher (FOR UPDATE SKIP LOCKED, status
--    'sending'). A row stuck in 'sending' for 10 minutes (a flusher that
--    died mid-send) is claimable again.
--
-- 2. Sign-up confirmation. The confirmation page redeems the link, then
--    saves the password the user typed (ResetPasswordPage.jsx), which fires
--    on_auth_password_changed. For an account still awaiting approval that
--    is part of signing up, not a password change, so no email is queued.
--    The bookkeeping (history, session sign-out) still runs.
--
-- Run: supabase db query --linked --file supabase/security_email_dedupe_migration.sql

begin;

create or replace function public.claim_security_emails(max_rows int default 50)
returns setof public.security_email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.security_email_outbox o
     set status = 'sending', sent_at = now()
   where o.id in (
     select id from public.security_email_outbox
      where status = 'pending'
         or (status = 'sending' and sent_at < now() - interval '10 minutes')
      order by created_at
      limit greatest(1, least(coalesce(max_rows, 50), 100))
      for update skip locked
   )
  returning o.*;
end;
$$;
revoke execute on function public.claim_security_emails(int) from public, anon, authenticated;
grant execute on function public.claim_security_emails(int) to service_role;

create or replace function public.on_auth_password_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_locked boolean := false;
  was_waiting boolean := false;
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
  update public.account_lockouts
     set failed_count = 0, first_failed_at = null, failed_apps = '{}', require_reset = false,
         locked_at = null, updated_at = now()
   where user_id = new.id;

  insert into public.account_lock_events (user_id, event, actor_name, detail)
  values (new.id, 'password_changed', 'user', jsonb_build_object('was_locked', coalesce(was_locked, false)));

  delete from auth.sessions where user_id = new.id;

  select coalesce(nullif(trim(full_name), ''), new.email), status into display, account_status
    from public.profiles where id = new.id;
  perform public.account_security_audit(new.id, 'Password changed',
    case when coalesce(was_waiting, false) then 'New password set after an administrator unlocked the account. Signed out of all sessions.'
         else 'Password changed. Signed out of all sessions.' end,
    coalesce(display, new.email));

  if account_status is distinct from 'Pending' then
    insert into public.security_email_outbox (kind, user_id, to_email, payload)
    values ('password_changed', new.id, new.email, jsonb_build_object('name', coalesce(display, new.email), 'at', now()));
    perform public.security_email_kick();
  end if;
  return new;
exception when others then
  raise warning 'password change bookkeeping skipped: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function public.on_auth_password_changed() from public, anon, authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   Re-run the on_auth_password_changed block from account_unlock_link_migration.sql, then:
--   drop function if exists public.claim_security_emails(int);
--   (and revert flushSecurityOutbox in api/_lib/securityEmails.js)
