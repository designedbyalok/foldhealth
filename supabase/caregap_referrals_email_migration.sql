-- Care Gap referrals: email + Messages + notifications upgrade.
--
-- Runs on top of caregap_referrals_migration.sql (already applied). Safe to
-- re-run: every change is "if not exists" / "or replace".
--
--   • caregap_referrals gets the Email fields (subject, body), the sender's
--     profile id (Messages > Email > Sent) and the recipient's read time
--     (Inbox unread state).
--   • eFax senders moved to efax_numbers (efax_numbers_migration.sql), so
--     the two eFax rows seeded into referral_sender_lines are removed.
--   • Referrals can be saved as 'Draft' and later 'Signed & Referred'
--     (status is free text; no constraint change needed).
--   • Referred users get an in-app notification when a referral is signed &
--     referred, not while it is a draft (notifications.referral_id + an AFTER
--     INSERT / UPDATE OF status trigger). Email referrals open in Messages >
--     Email.

begin;

alter table public.caregap_referrals
  add column if not exists email_subject     text,
  add column if not exists email_body        text,
  add column if not exists sent_by_id        uuid,
  add column if not exists recipient_read_at timestamptz;

create index if not exists caregap_referrals_provider_idx
  on public.caregap_referrals (provider_id, created_at desc);

delete from public.referral_sender_lines where channel = 'efax';

-- ── Notify the referred user ────────────────────────────────────────────────
-- The recipient is a system user (profiles.id in provider_id). Every channel
-- notifies them; an Email referral opens its thread in Messages > Email
-- (action 'openEmail' + referral_id). Profiles that share the recipient's
-- display name (duplicate rows for one person) are notified too, matching
-- caregap_comments_migration.sql.
alter table public.notifications
  add column if not exists referral_id text;

create or replace function public.emit_caregap_referral_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor     uuid := coalesce(new.sent_by_id, auth.uid());
  recipient uuid;
  label     text;
begin
  -- Drafts aren't sent: notify on a non-draft insert, or when a draft is
  -- signed & referred.
  if new.status = 'Draft' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status is distinct from 'Draft' then
      return new;
    end if;
  end if;
  begin
    -- provider_id is text; skip anything that isn't a profile uuid.
    if new.provider_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return new;
    end if;
    recipient := new.provider_id::uuid;
    label := case new.channel
      when 'efax' then 'eFax' when 'email' then 'Email' when 'sms' then 'SMS' else 'Chat' end;

    insert into public.notifications
      (recipient_id, actor_id, actor_name, type, title, body, action, referral_id)
    select distinct r.id, actor, new.sent_by, 'referral.received',
           'New referral via ' || label,
           concat_ws(' · ', new.member_name, new.gap_code,
                     coalesce(nullif(new.email_subject, ''), left(new.reason, 120))),
           case when new.channel = 'email' then 'openEmail' end,
           new.id
      from (
        select p.id from public.profiles p where p.id = recipient
        union
        select s.id
          from public.profiles picked
          join public.profiles s
            on nullif(btrim(picked.full_name), '') is not null
           and lower(btrim(s.full_name)) = lower(btrim(picked.full_name))
         where picked.id = recipient
      ) r
     where r.id is distinct from actor;
  exception when others then
    -- A notification must never be able to break sending a referral.
    raise warning 'emit_caregap_referral_notifications skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.emit_caregap_referral_notifications() from public, anon, authenticated;

drop trigger if exists caregap_referrals_emit_notifications on public.caregap_referrals;
create trigger caregap_referrals_emit_notifications
  after insert or update of status on public.caregap_referrals
  for each row execute function public.emit_caregap_referral_notifications();

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--    where table_name = 'caregap_referrals'
--      and column_name in ('email_subject', 'email_body', 'sent_by_id', 'recipient_read_at');  -- expect 4
--   select count(*) from public.referral_sender_lines where channel = 'efax';                  -- expect 0
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop trigger if exists caregap_referrals_emit_notifications on public.caregap_referrals;
--   drop function if exists public.emit_caregap_referral_notifications();
--   alter table public.notifications drop column if exists referral_id;
--   alter table public.caregap_referrals
--     drop column if exists email_subject, drop column if exists email_body,
--     drop column if exists sent_by_id, drop column if exists recipient_read_at;
