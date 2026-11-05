-- Care Program Configuration (Settings > Care Program Configuration).
--
-- One row per program type (SNP, AWV, CCM, ...). The patient's program view
-- reads `steps` to decide which steps a program shows, in what order and
-- which are mandatory; the enroll menu lists the active types. The rest of
-- the configuration is kept here for the program's settings screens:
--
--   steps       [{ id, name, kind?, type?: 'section', enabled, mandatory, hasAlert?, custom?, children? }]
--               Step ids are what care_program_step_status.step_id refers to, so they never change.
--   worklists   [{ id, name, description, assignmentMode, assigneeIds[], statuses[], showInNavigation }]
--   care_team   [{ id, role, teamId, defaultAssigneeId, stepIds[] }]
--   completion  { requireMandatorySteps, requireCarePlanSigned, minOutreachAttempts,
--                 maxDurationDays, autoCloseInactiveDays, completionStatus }
--   access      { showInNavigation, navigationRoles[], enrollRoles[], settingsRoles[] }
--
-- Seed: `bun run seed` (scripts/seed.js) upserts the built-in program types.

begin;

create table if not exists public.care_program_types (
  id              text        primary key,
  code            text        not null unique,
  name            text        not null,
  description     text        not null default '',
  status          text        not null default 'active' check (status in ('active', 'draft', 'inactive')),
  allow_multiple  boolean     not null default false,
  steps           jsonb       not null default '[]'::jsonb,
  worklists       jsonb       not null default '[]'::jsonb,
  care_team       jsonb       not null default '[]'::jsonb,
  completion      jsonb       not null default '{}'::jsonb,
  access          jsonb       not null default '{}'::jsonb,
  sort_order      integer     not null default 0,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.care_program_types_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists care_program_types_touch on public.care_program_types;
create trigger care_program_types_touch
  before update on public.care_program_types
  for each row execute function public.care_program_types_touch();

alter table public.care_program_types enable row level security;

drop policy if exists care_program_types_all on public.care_program_types;
create policy care_program_types_all on public.care_program_types
  for all to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop table if exists public.care_program_types;
--   drop function if exists public.care_program_types_touch();
