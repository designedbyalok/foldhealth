-- =====================================================================
-- clinical_notes_origin_migration.sql
--
-- Audit gap (P1-3, schema half): `clinical_notes` only supports one
-- origin, HEDIS Care Gap, represented by `gap_codes text[]`. Other
-- workflows that have an "Add Note" affordance (Care Plan Goal, Care
-- Plan Intervention, Care Program, Diagnosis Gap, Task drawer, patient
-- header) either write to unrelated tables (`care_plan_*`,
-- `sticky_notes`) or their menu item is a dead handler. None of those
-- notes reach P360, none participate in the review flow, and there is
-- no single "clinical note" concept the way §1 of the spec requires.
--
-- This migration adds a compact polymorphic pair of columns so any
-- origin can persist a real `clinical_notes` row and be found by both
-- the P360 Notes tab AND its origin (e.g. a Goal drawer can list its
-- linked notes).
--
--   origin_kind text: one of a fixed enum (see CHECK); nullable so
--                      existing HEDIS-origin rows can be backfilled
--                      lazily. HEDIS Care Gap notes should read
--                      'care_gap' once wired.
--
--   origin_ref  text: the id of the origin record. Left as text so we
--                      don't have to pick between bigint (tasks.id) and
--                      uuid (care-plan/goal ids); the calling code
--                      knows the shape per kind.
--
-- Idempotent; safe to re-run.
-- =====================================================================

alter table public.clinical_notes
  add column if not exists origin_kind text,
  add column if not exists origin_ref text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'clinical_notes_origin_kind_check'
       and conrelid = 'public.clinical_notes'::regclass
  ) then
    alter table public.clinical_notes
      add constraint clinical_notes_origin_kind_check
      check (origin_kind is null or origin_kind in (
        'care_gap',
        'care_program',
        'care_plan_goal',
        'care_plan_intervention',
        'diagnosis_gap',
        'task',
        'patient'
      ));
  end if;
end$$;

comment on column public.clinical_notes.origin_kind is
  'Which workflow authored this note. NULL on legacy rows; new writes should set this.';
comment on column public.clinical_notes.origin_ref is
  'Origin record id (task_id, care_plan_goal_id, care_program_id, diagnosis_gap_id, etc.) as text so we do not have to pick a single id type.';

-- Reverse lookup for a specific origin, e.g. "list every note attached
-- to this Task" or "list every note for Care Plan Goal X". Partial so
-- the index stays small and only covers rows that carry origin data.
create index if not exists clinical_notes_origin_idx
  on public.clinical_notes (origin_kind, origin_ref)
  where origin_kind is not null;

-- ---------------------------------------------------------------------
-- Backfill: mark every existing row whose gap_codes is populated as a
-- 'care_gap' origin. The origin_ref stays NULL because a Care Gap note
-- can carry many codes and no single anchor row exists today.
-- ---------------------------------------------------------------------

update public.clinical_notes
   set origin_kind = 'care_gap'
 where origin_kind is null
   and array_length(gap_codes, 1) is not null;
