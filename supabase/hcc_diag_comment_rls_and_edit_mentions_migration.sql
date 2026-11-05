-- HCC Diagnosis Gap comments: author-only writes + notify mentions added on edit.
--
-- Follows hcc_diag_comment_author_migration.sql, which gave every new comment
-- a server-stamped author_id.
--
-- THE HOLES THIS CLOSES
--   1. RLS was a single "Allow all … USING (true)" policy, so any signed-in
--      user could edit or delete anyone's comment. The UI hides the edit menu
--      on other people's comments, but that is not enforcement: the anon-key
--      client can issue the UPDATE/DELETE directly.
--   2. The mention trigger only ran on INSERT. Editing a comment to add a new
--      @mention notified nobody.
--
-- WHAT THIS DOES
--   1. Replaces the allow-all policy with four:
--        SELECT: every signed-in staff member (unchanged; the practice-wide
--                  read model in RLS_POSTURE.md still applies).
--        INSERT: author_id must be the caller. The BEFORE INSERT trigger
--                  already stamps it, so a normal post always passes.
--        UPDATE: own comments only.
--        DELETE: own comments only.
--      Legacy rows with no author_id (unattributable 'You' rows) become
--      read-only for everyone, matching what the UI already shows.
--      The service role (seed script, SQL editor) bypasses RLS as before.
--   2. BEFORE UPDATE trigger pins author / author_id, so an author cannot
--      re-attribute their own comment to someone else.
--   3. The notification trigger now also runs AFTER UPDATE OF mention_ids and
--      notifies only ids that are newly present (new minus old), so re-saving
--      an edit never re-pings people who were already mentioned.

begin;

-- ── 1. Policies ─────────────────────────────────────────────────────────────
alter table public.hcc_diag_comments enable row level security;

drop policy if exists "Allow all for hcc_diag_comments" on public.hcc_diag_comments;
drop policy if exists hcc_diag_comments_select on public.hcc_diag_comments;
drop policy if exists hcc_diag_comments_insert_own on public.hcc_diag_comments;
drop policy if exists hcc_diag_comments_update_own on public.hcc_diag_comments;
drop policy if exists hcc_diag_comments_delete_own on public.hcc_diag_comments;

create policy hcc_diag_comments_select
  on public.hcc_diag_comments for select
  to authenticated
  using (true);

create policy hcc_diag_comments_insert_own
  on public.hcc_diag_comments for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy hcc_diag_comments_update_own
  on public.hcc_diag_comments for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy hcc_diag_comments_delete_own
  on public.hcc_diag_comments for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ── 2. Authorship is immutable after insert ─────────────────────────────────
create or replace function public.pin_hcc_diag_comment_author()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.author    := old.author;
  new.author_id := old.author_id;
  return new;
end;
$$;

drop trigger if exists hcc_diag_comments_pin_author on public.hcc_diag_comments;
create trigger hcc_diag_comments_pin_author
  before update on public.hcc_diag_comments
  for each row execute function public.pin_hcc_diag_comment_author();

-- ── 3. Mention notifications on INSERT and on edit ──────────────────────────
create or replace function public.emit_hcc_diag_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor    uuid := coalesce(new.author_id, auth.uid());
  new_ids  uuid[];
  patient  text;
  snippet  text;
begin
  -- Only ids added by THIS statement: all of them on insert, the difference
  -- on update. Removing a mention or re-saving the same text notifies nobody.
  if tg_op = 'INSERT' then
    new_ids := new.mention_ids;
  else
    select array(
      select m from unnest(coalesce(new.mention_ids, '{}'::uuid[])) m
      except
      select o from unnest(coalesce(old.mention_ids, '{}'::uuid[])) o
    ) into new_ids;
  end if;

  if coalesce(array_length(new_ids, 1), 0) = 0 then
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
        select p.id
          from unnest(new_ids) as u(id)
          join public.profiles p on p.id = u.id
        union
        select s.id
          from unnest(new_ids) as u(id)
          join public.profiles picked on picked.id = u.id
          join public.profiles s
            on nullif(btrim(picked.full_name), '') is not null
           and lower(btrim(s.full_name)) = lower(btrim(picked.full_name))
      ) r
     where r.id is distinct from actor;
  exception when others then
    raise warning 'emit_hcc_diag_comment_notifications skipped: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.emit_hcc_diag_comment_notifications() from public, anon, authenticated;

drop trigger if exists hcc_diag_comments_emit_notifications on public.hcc_diag_comments;
create trigger hcc_diag_comments_emit_notifications
  after insert or update of mention_ids on public.hcc_diag_comments
  for each row execute function public.emit_hcc_diag_comment_notifications();

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select policyname, cmd from pg_policies where tablename='hcc_diag_comments';
--   Expect: _select (SELECT), _insert_own, _update_own, _delete_own.
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop policy hcc_diag_comments_select, hcc_diag_comments_insert_own,
--        hcc_diag_comments_update_own, hcc_diag_comments_delete_own
--     on public.hcc_diag_comments;
--   create policy "Allow all for hcc_diag_comments" on public.hcc_diag_comments
--     for all to authenticated using (true) with check (true);
--   drop trigger if exists hcc_diag_comments_pin_author on public.hcc_diag_comments;
--   drop function if exists public.pin_hcc_diag_comment_author();
--   Then re-run hcc_diag_comment_author_migration.sql to restore the INSERT-only
--   notification trigger.
