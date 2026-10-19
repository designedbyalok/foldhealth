-- "A user asked to unlock their account" emails went to every practice admin.
-- Now they go to one address, security_settings.unlock_request_email
-- (alokk@fold.health). Admins still get the in-app "Unlock requested"
-- notification, so whoever is on hand can unlock from Settings, Users.
--
-- Falls back to every admin when the setting is missing, or when the person
-- asking is the one who would get the email (otherwise nobody hears).
--
-- Run: supabase db query --linked --file supabase/unlock_request_email_recipient_migration.sql

begin;

insert into public.security_settings (key, value)
values ('unlock_request_email', 'alokk@fold.health')
on conflict (key) do update set value = excluded.value;

create or replace function public.request_account_unlock(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  target_email text;
  display text;
  rec public.account_lockouts;
  recipient text;
begin
  select u.id, u.email, coalesce(nullif(trim(p.full_name), ''), u.email)
    into uid, target_email, display
    from auth.users u left join public.profiles p on p.id = u.id
   where lower(u.email) = lower(trim(p_email)) limit 1;
  if uid is null then return; end if;
  select * into rec from public.account_lockouts where user_id = uid;
  if rec.user_id is null or (rec.locked_at is null and not rec.require_reset) then return; end if;
  if exists (select 1 from public.account_lock_events
              where user_id = uid and event = 'unlock_requested' and created_at > now() - interval '15 minutes') then
    return;
  end if;

  insert into public.account_lock_events (user_id, event, actor_id, actor_name)
  values (uid, 'unlock_requested', uid, display);
  perform public.account_security_audit(uid, 'Unlock requested',
    'Asked an administrator to unlock the account from the sign-in screen.', display);

  insert into public.notifications (recipient_id, actor_id, actor_name, type, title, body, action)
  select a.id, uid, display, 'user.unlock_requested', 'Unlock requested',
         display || ' asked an administrator to unlock their account.', 'openLockedUsers'
    from public.profiles a
   where a.status = 'Active' and a.id <> uid
     and (a.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
          or 'Admin/Practice Manager' = any(coalesce(a.clinical_roles, '{}')));

  select nullif(trim(value), '') into recipient from public.security_settings where key = 'unlock_request_email';
  if recipient is not null and lower(recipient) <> lower(target_email) then
    insert into public.security_email_outbox (kind, user_id, to_email, payload)
    values ('unlock_requested', uid, recipient,
            jsonb_build_object('name', display, 'email', target_email, 'at', now()));
  else
    insert into public.security_email_outbox (kind, user_id, to_email, payload)
    select 'unlock_requested', uid, a.email,
           jsonb_build_object('name', display, 'email', target_email, 'at', now())
      from public.profiles a
     where a.status = 'Active' and a.id <> uid and a.email is not null
       and (a.admin_role in ('Admin/Practice Manager', 'Business/Practice Owner')
            or 'Admin/Practice Manager' = any(coalesce(a.clinical_roles, '{}')));
  end if;
  perform public.security_email_kick();
end;
$$;
revoke execute on function public.request_account_unlock(text) from public;
grant execute on function public.request_account_unlock(text) to anon, authenticated, service_role;

commit;

-- Rollback: re-run the request_account_unlock block from account_unlock_link_migration.sql,
-- then: delete from public.security_settings where key = 'unlock_request_email';
