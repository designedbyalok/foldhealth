-- =====================================================================
-- tasks_hedis_linkage_migration.sql
--
-- Persist the HEDIS Sign-Off task ↔ member / gap linkage as real
-- columns on `public.tasks`. Today `createCareGapSignOffTask` builds a
-- task with `hedisMemberId` + `hedisGapCodes` in memory but strips them
-- from the INSERT via a client-side `dbOmit` (src/store/useAppStore.js).
-- After reload the UI reconstructs them by name-matching `task.member`
-- against `hedis_members` and by treating `task.labels` as the gap-code
-- list: brittle: two members with the same name collide, and any
-- non-gap label (a program tag, a care-journey chip) is treated as a
-- gap code.
--
-- Ships two columns:
--   • hedis_member_id: text, FK-shaped (matches hedis_members.id text)
--   • hedis_gap_codes: text[], mirrors clinical_notes.gap_codes shape
-- Plus an index on hedis_member_id for the reviewer / drawer lookups.
--
-- Backfill: for every HEDIS Sign-Off task whose member name matches
-- exactly one hedis_members row, copy that id and copy task.labels into
-- hedis_gap_codes. Tasks whose name collides across members are left as
-- NULL so the UI still falls back to the legacy name-match, and a note
-- is logged so a follow-up can resolve them by hand.
-- =====================================================================

alter table public.tasks
  add column if not exists hedis_member_id text,
  add column if not exists hedis_gap_codes text[] default '{}'::text[];

comment on column public.tasks.hedis_member_id is
  'HEDIS member id (matches public.hedis_members.id), set only for tasks in the HEDIS Sign-Off pool. NULL for every other task type.';
comment on column public.tasks.hedis_gap_codes is
  'Gap codes this sign-off task covers (subset of the codes on the linked clinical_notes row). Empty array for non-HEDIS tasks.';

create index if not exists tasks_hedis_member_idx
  on public.tasks (hedis_member_id)
  where hedis_member_id is not null;

-- ---------------------------------------------------------------------
-- Backfill existing sign-off tasks by unique-name match.
-- Uses a CTE so we can pick out ambiguous names (>1 member with the
-- same display name) and leave those NULL, the UI's existing legacy
-- fallback still covers them.
-- ---------------------------------------------------------------------

with unique_members as (
  select name, min(id) as id, count(*) as n
    from public.hedis_members
   where name is not null and name <> ''
   group by name
)
update public.tasks t
   set hedis_member_id = u.id,
       hedis_gap_codes = coalesce(t.labels, '{}'::text[])
  from unique_members u
 where t.pool = 'HEDIS Sign-Off'
   and t.hedis_member_id is null
   and u.name = t.member
   and u.n = 1;

-- ---------------------------------------------------------------------
-- caregap_activity: add a PK constraint on id so future seed
-- INSERT ... ON CONFLICT (id) DO NOTHING statements are idempotent.
-- The bootstrap migration declared `id text not null` without a PK;
-- fresh envs still work but re-seeding would double-write rows. Guard
-- against re-adding the same constraint by name.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'caregap_activity_pkey'
       and conrelid = 'public.caregap_activity'::regclass
  ) then
    alter table public.caregap_activity
      add constraint caregap_activity_pkey primary key (id);
  end if;
end$$;
