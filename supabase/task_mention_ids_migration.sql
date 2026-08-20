-- Resolve @mentions by profile id instead of re-parsing the comment text.
--
-- THE HOLE THIS CLOSES
-- `tasks.mentions` is a text[] of display names that TaskDetailDrawer scraped
-- back out of the submitted comment body with:
--
--   text.match(/@(\w+(?:\s+\w+)?)/g)
--
-- CommentComposer already knew exactly who was picked — the mention menu is
-- built from `profiles` rows and had the id in hand — and then threw it away,
-- keeping only the name. So intent was recovered by guessing at a string, and
-- the guess is wrong in ordinary cases:
--
--   "@Ana-Maria Cruz"        → captures "Ana"      (\w stops at the hyphen)
--   "@Fold Demo, please"     → captures "Fold Demo" only by luck of ordering
--   "@ketanpatni02 ping"     → captures a handle nobody is named → no notify
--   "hi @fold demo"          → stored lowercase, and the Mentions tab's
--                              exact-compare then missed it entirely
--
-- The composer now stamps `data-mention-id` on each chip and hands the parent
-- `[{ id, name }]` for the chips actually left in the editor. This migration
-- gives that a column and teaches the notification trigger to prefer it.
--
-- WHAT THIS DOES
--   1. Adds `tasks.mention_ids uuid[]`.
--   2. Replaces `emit_task_notifications()` so the mention branch prefers
--      newly-added `mention_ids` and only falls back to name resolution when
--      no ids were added on this statement.
--
-- WHY IDS ARE STILL EXPANDED BY NAME
-- `profiles` holds one row per email a person ever signed up with — three are
-- named "Alok Kumar" — and the picker's roster (`fetchPlatformUsers`) dedupes
-- by name, so it can only ever offer ONE of those ids. If we notified that id
-- alone, a person signed in as a different one of their own duplicate rows
-- would silently miss the mention, which is worse than today. So an id is
-- expanded to every profile sharing its display name before rows are written.
--
-- The win from ids is therefore not "fewer recipients" — it is that the set of
-- recipients is derived from a picked identity rather than from a regex over
-- free text, so typos, punctuation, casing, handles, and later edits to the
-- comment body cannot change who gets told. Name expansion is the deliberate
-- concession to duplicate profiles; collapsing profiles to one row per human
-- is the real fix and is out of scope here.

begin;

-- ── 1. Column ───────────────────────────────────────────────────────────────
alter table public.tasks
  add column if not exists mention_ids uuid[];

comment on column public.tasks.mention_ids is
  'profiles.id values picked in the CommentComposer mention menu. Authoritative over tasks.mentions (display names), which is retained for rendering and for rows written before ids were captured.';

-- ── 2. Trigger ──────────────────────────────────────────────────────────────
create or replace function public.emit_task_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor            uuid := auth.uid();
  actor_label      text;
  assignee_changed boolean;
  new_mentions     text[];
  new_mention_ids  uuid[];
  mention          text;
begin
  -- Display name for the actor, best-effort. Falls back to the row's own
  -- attribution so a seeded or service-role write still reads sensibly.
  select coalesce(p.full_name, p.email, new.created_by, 'Someone')
    into actor_label
    from public.profiles p
   where p.id = actor;
  actor_label := coalesce(actor_label, new.created_by, 'Someone');

  -- ── Assignment ──
  -- The tg_op test is a separate statement on purpose. PL/pgSQL leaves OLD
  -- *unassigned* (not null) in an INSERT trigger, and touching a field on an
  -- unassigned record raises `record "old" is not assigned yet` — so folding
  -- this into one OR'd condition would abort every task INSERT.
  if tg_op = 'INSERT' then
    assignee_changed := new.assigned_to_id is not null;
  else
    assignee_changed := new.assigned_to_id is not null
                    and new.assigned_to_id is distinct from old.assigned_to_id;
  end if;

  if assignee_changed and new.assigned_to_id is distinct from actor then
    insert into public.notifications
      (recipient_id, actor_id, actor_name, type, title, body, action, task_id)
    values
      (new.assigned_to_id, actor, actor_label, 'task.assigned',
       'You were assigned a task', new.name, 'openTask', new.id);
  end if;

  -- ── @mentions, by id where we have them ──
  -- Only ids added by THIS statement, so editing an unrelated field on a task
  -- that already carries mentions does not re-notify everyone.
  if tg_op = 'INSERT' then
    new_mention_ids := new.mention_ids;
  else
    select array(
      select m from unnest(coalesce(new.mention_ids, '{}'::uuid[])) m
      except
      select o from unnest(coalesce(old.mention_ids, '{}'::uuid[])) o
    ) into new_mention_ids;
  end if;

  if new_mention_ids is not null and array_length(new_mention_ids, 1) > 0 then
    -- Expand each picked id to every profile sharing that display name (see
    -- the header note on duplicate profiles), then dedupe.
    insert into public.notifications
      (recipient_id, actor_id, actor_name, type, title, body, action, task_id)
    select distinct sibling.id, actor, actor_label, 'task.mentioned',
           'You were mentioned in a task', new.name, 'openTask', new.id
      from unnest(new_mention_ids) picked_id
      join public.profiles picked on picked.id = picked_id
      join public.profiles sibling
        on lower(btrim(sibling.full_name)) = lower(btrim(picked.full_name))
     where sibling.id is distinct from actor;

  -- ── Legacy path: names only ──
  -- Rows written before ids were captured, and any writer that isn't the
  -- composer (seed script, SQL editor, a paste of literal "@Name" text).
  elsif new.mentions is not null and array_length(new.mentions, 1) > 0 then
    if tg_op = 'INSERT' then
      new_mentions := new.mentions;
    else
      select array(
        select m from unnest(new.mentions) m
        except
        select o from unnest(coalesce(old.mentions, '{}'::text[])) o
      ) into new_mentions;
    end if;

    foreach mention in array coalesce(new_mentions, '{}'::text[]) loop
      insert into public.notifications
        (recipient_id, actor_id, actor_name, type, title, body, action, task_id)
      select p.id, actor, actor_label, 'task.mentioned',
             'You were mentioned in a task', new.name, 'openTask', new.id
        from public.profiles p
       where lower(btrim(p.full_name)) = lower(btrim(mention))
         and p.id is distinct from actor;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.emit_task_notifications() from public, anon, authenticated;

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Column exists:
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='tasks' and column_name='mention_ids';
--   Expect: mention_ids | ARRAY
--
-- Id path fires, and expands across duplicate-named profiles. Pick a name with
-- more than one profiles row:
--   select id, full_name, email from profiles where full_name = 'Alok Kumar';
--   -- take any ONE of those ids
--   update tasks set mention_ids = array['<one alok id>'::uuid] where id = <task id>;
--   select count(*) from notifications
--    where task_id = <task id> and type='task.mentioned';
--   Expect: one row per Alok Kumar profile (3 in this database), not 1.
--
-- Only newly-added ids notify. Add a second id and confirm the first does not
-- re-fire:
--   update tasks set mention_ids = array['<alok id>','<other id>']::uuid[] where id = <task id>;
--   Expect: only the rows for <other id>'s name.
--
-- Id path SUPPRESSES the legacy name path — a composer write sets both columns
-- and must not double-notify:
--   update tasks set mention_ids = array['<alok id>']::uuid[],
--                    mentions    = array['Alok Kumar']
--    where id = <task id>;
--   Expect: the id-path rows only (one per Alok profile), not double that.
--
-- Legacy name path still works when no ids are added:
--   update tasks set mentions = array['Fold Demo'] where id = <task id>;
--   Expect: one row for the Fold Demo profile.
--
-- ── Rollback ────────────────────────────────────────────────────────────────
-- Restore the previous function body from notifications_migration.sql, then:
--   alter table public.tasks drop column if exists mention_ids;
