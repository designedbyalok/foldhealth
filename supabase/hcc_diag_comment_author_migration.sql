-- HCC Diagnosis Gap comments: real authorship + mention notifications.
--
-- THE HOLES THIS CLOSES
--   1. Every client wrote the literal string 'You' into hcc_diag_comments.author
--      (LeftWorkspace.addComment and both useDiagPanel status comments). 'You'
--      is a viewer-relative label, not an identity, so once stored it read as
--      "You" for EVERY reader: and the Comments tab decided edit/delete rights
--      with `author === 'You'`, which meant everyone could edit everyone's
--      comments. There was no author id column at all.
--   2. @mentions never reached the mentioned person. addHccDiagComment called
--      addNotification, which is ephemeral and runs in the COMMENTER's tab, and
--      it only fired when the comment mentioned the current user (the author).
--      This is the same wrong-browser shape notifications_migration.sql fixed
--      for tasks. Nothing was ever written to public.notifications.
--
-- WHAT THIS DOES
--   1. Adds hcc_diag_comments.author_id (uuid) and mention_ids (uuid[]).
--   2. BEFORE INSERT trigger stamps author_id := auth.uid() and author := the
--      signed-in profile's display name. Authoritative on the server, so an
--      old client still sending 'You' is corrected and nobody can post as
--      someone else. Writes with no JWT (seed script, SQL editor) keep what
--      they were given, so seeded names still render.
--   3. AFTER INSERT trigger writes one notifications row per mentioned
--      profile (expanded across duplicate-named profiles, same concession as
--      task_mention_ids_migration.sql), skipping the author. Wrapped so a
--      notification failure can never roll back the comment itself.
--   4. Adds notifications.hcc_member_id so a mention can open the right
--      patient's Diagnosis Gap panel from the bell.
--   5. Backfills author_id/author for legacy 'You' rows ONLY where the
--      matching hcc_activity_log event (same body, same patient, within two
--      minutes) carries a real actor_id. Rows without that evidence are left
--      as-is; the client renders them as "Unknown author" rather than guessing.
--
-- Mention ids are UUIDs only. The HCC mention roster falls back to a plain name
-- for staff with no login (recordParticipants.js); those people have no
-- profile and therefore nothing to notify, so the client drops them before the
-- write: a non-UUID in a uuid[] would reject the comment insert.

begin;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table public.hcc_diag_comments add column if not exists author_id   uuid;
alter table public.hcc_diag_comments add column if not exists mention_ids uuid[];
alter table public.notifications     add column if not exists hcc_member_id text;

-- ── 2. Server-side author stamp ─────────────────────────────────────────────
create or replace function public.stamp_hcc_diag_comment_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  label text;
begin
  if actor is null then
    return new;  -- seed / service role: keep the supplied author
  end if;
  new.author_id := actor;
  select coalesce(
           nullif(btrim(p.full_name), ''),
           nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
           nullif(split_part(p.email, '@', 1), '')
         )
    into label
    from public.profiles p
   where p.id = actor;
  if label is not null then
    new.author := label;
  end if;
  return new;
end;
$$;

revoke all on function public.stamp_hcc_diag_comment_author() from public, anon, authenticated;

drop trigger if exists hcc_diag_comments_stamp_author on public.hcc_diag_comments;
create trigger hcc_diag_comments_stamp_author
  before insert on public.hcc_diag_comments
  for each row execute function public.stamp_hcc_diag_comment_author();

-- ── 3. Mention → notification producer ──────────────────────────────────────
create or replace function public.emit_hcc_diag_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor    uuid := coalesce(new.author_id, auth.uid());
  patient  text;
  snippet  text;
begin
  if new.mention_ids is null or coalesce(array_length(new.mention_ids, 1), 0) = 0 then
    return new;
  end if;

  begin
    select m.name into patient
      from public.hcc_members m
     where m.id = new.hcc_member_id
     limit 1;

    snippet := left(regexp_replace(coalesce(new.body, ''), '@', '', 'g'), 160);

    insert into public.notifications
      (recipient_id, actor_id, actor_name, type, title, body, action, hcc_member_id)
    select distinct r.id, actor, new.author, 'hcc.comment_mention',
           'You were mentioned in a comment',
           concat_ws(' · ', patient, new.icd) ||
             case when patient is null and new.icd is null then '' else ': ' end ||
             snippet,
           'openDiagPanel', new.hcc_member_id
      from (
        -- the picked profiles themselves …
        select p.id
          from unnest(new.mention_ids) as u(id)
          join public.profiles p on p.id = u.id
        union
        -- … plus every profile sharing a picked display name (duplicate rows
        -- per human; see task_mention_ids_migration.sql).
        select s.id
          from unnest(new.mention_ids) as u(id)
          join public.profiles picked on picked.id = u.id
          join public.profiles s
            on nullif(btrim(picked.full_name), '') is not null
           and lower(btrim(s.full_name)) = lower(btrim(picked.full_name))
      ) r
     where r.id is distinct from actor;
  exception when others then
    -- A notification must never be able to break a comment save.
    raise warning 'emit_hcc_diag_comment_notifications skipped: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.emit_hcc_diag_comment_notifications() from public, anon, authenticated;

drop trigger if exists hcc_diag_comments_emit_notifications on public.hcc_diag_comments;
create trigger hcc_diag_comments_emit_notifications
  after insert on public.hcc_diag_comments
  for each row execute function public.emit_hcc_diag_comment_notifications();

-- ── 4. Backfill recoverable legacy 'You' rows ───────────────────────────────
-- Only rows with direct evidence of who wrote them. Everything else is left
-- untouched (no guessing).
with ev as (
  select distinct on (c.id) c.id as comment_id, a.actor_id::uuid as actor_id
    from public.hcc_diag_comments c
    join public.hcc_activity_log a
      on a.event_name = 'icd.comment_added'
     and a.payload->>'body' = c.body
     and a.patient_id = c.hcc_member_id
     and abs(extract(epoch from (a.ts - c.created_at))) < 120
   where c.author = 'You'
     and c.author_id is null
     and a.actor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   order by c.id, abs(extract(epoch from (a.ts - c.created_at)))
)
update public.hcc_diag_comments c
   set author_id = ev.actor_id,
       author    = coalesce(
                     nullif(btrim(p.full_name), ''),
                     nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
                     c.author)
  from ev
  join public.profiles p on p.id = ev.actor_id
 where c.id = ev.comment_id;

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select tgname from pg_trigger
--    where tgrelid='public.hcc_diag_comments'::regclass and not tgisinternal;
--   Expect: hcc_diag_comments_stamp_author, hcc_diag_comments_emit_notifications
--
--   select author, count(*) from hcc_diag_comments group by author;
--   Expect: fewer 'You' rows (only the unrecoverable legacy ones remain).
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop trigger if exists hcc_diag_comments_emit_notifications on public.hcc_diag_comments;
--   drop trigger if exists hcc_diag_comments_stamp_author on public.hcc_diag_comments;
--   drop function if exists public.emit_hcc_diag_comment_notifications();
--   drop function if exists public.stamp_hcc_diag_comment_author();
--   alter table public.notifications     drop column if exists hcc_member_id;
--   alter table public.hcc_diag_comments drop column if exists mention_ids;
--   alter table public.hcc_diag_comments drop column if exists author_id;
