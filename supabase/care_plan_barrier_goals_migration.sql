-- Care Plan Barriers: goals are now truly many-to-many.
--
-- Historical shape: `patient_care_plan_barriers` carried a single `goal_id`
-- FK. Modelling "one barrier applies to several goals" meant cloning the
-- barrier row per goal, which showed up as visible duplicates in the plan
-- Barriers table.
--
-- This migration introduces `patient_care_plan_barrier_goals`, a proper
-- join table so a barrier row is unique per (plan, title) and its goal set
-- lives on the join. It also backfills existing clones by consolidating
-- them into a single row + N join entries, then drops the redundant
-- clone rows.
--
-- Idempotent: uses `if not exists` on every DDL and a NOT EXISTS guard on
-- the backfill so re-runs are safe.

-- 1. Join table.
create table if not exists public.patient_care_plan_barrier_goals (
  barrier_id uuid not null references public.patient_care_plan_barriers(id) on delete cascade,
  goal_id    uuid not null references public.care_plan_goals(id)             on delete cascade,
  created_at timestamptz not null default now(),
  primary key (barrier_id, goal_id)
);

comment on table public.patient_care_plan_barrier_goals is
  'Many-to-many link between a patient care-plan barrier and the goals it applies to. Replaces the legacy 1:1 goal_id column on patient_care_plan_barriers.';

create index if not exists patient_care_plan_barrier_goals_goal_idx
  on public.patient_care_plan_barrier_goals (goal_id);
create index if not exists patient_care_plan_barrier_goals_barrier_idx
  on public.patient_care_plan_barrier_goals (barrier_id);

-- 2. RLS — the join follows the parent barriers table's posture: any
-- authenticated user can select, insert, update, delete. No anon policies.
alter table public.patient_care_plan_barrier_goals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'patient_care_plan_barrier_goals'
      and policyname = 'auth_full'
  ) then
    create policy auth_full on public.patient_care_plan_barrier_goals
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- 3. Backfill from legacy goal_id, then consolidate title duplicates.
--    Step A: mirror every existing (barrier.id, barrier.goal_id) into the
--    join table.
insert into public.patient_care_plan_barrier_goals (barrier_id, goal_id)
select b.id, b.goal_id
  from public.patient_care_plan_barriers b
 where b.goal_id is not null
   and not exists (
     select 1
       from public.patient_care_plan_barrier_goals j
      where j.barrier_id = b.id and j.goal_id = b.goal_id
   );

--    Step B: consolidate title clones. For each (plan_id, normalized title)
--    group, keep the oldest row as the canonical barrier and repoint every
--    clone's join entries at it, then delete the clones.
do $$
declare
  grp record;
  keeper uuid;
begin
  for grp in
    select plan_id,
           lower(trim(title)) as norm_title,
           array_agg(id order by created_at asc, id asc) as ids
      from public.patient_care_plan_barriers
     group by plan_id, lower(trim(title))
    having count(*) > 1
  loop
    keeper := grp.ids[1];
    -- Move any join entries from clone barriers to the keeper.
    update public.patient_care_plan_barrier_goals
       set barrier_id = keeper
     where barrier_id = any(grp.ids)
       and barrier_id <> keeper
       and not exists (
         select 1 from public.patient_care_plan_barrier_goals jj
          where jj.barrier_id = keeper
            and jj.goal_id = public.patient_care_plan_barrier_goals.goal_id
       );
    -- Drop clone barrier rows (join rows still pointing at them cascade).
    delete from public.patient_care_plan_barriers
     where id = any(grp.ids)
       and id <> keeper;
  end loop;
end $$;

-- 4. The legacy goal_id column stays for backwards compatibility with
--    older client builds; new writes go through the join table. A future
--    migration can drop it once every client reads goalIds from the join
--    exclusively.
