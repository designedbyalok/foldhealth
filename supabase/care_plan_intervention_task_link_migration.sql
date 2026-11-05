-- Care Plan Interventions ↔ Tasks: collapse to a single record.
--
-- Historical shape: `patient_care_plan_interventions` and `tasks` were two
-- disjoint records for the same conceptual thing (an intervention IS a
-- task the patient or staff carries out). The Add Intervention flow used
-- to write to `patient_care_plan_interventions` only; the Add Task flow
-- (used by patient-task / internal-task kinds) additionally wrote a
-- `tasks` row and stored its id in `patient_care_plan_interventions.config.taskId`,
-- but nothing read that id, so completing the task never updated the
-- intervention.
--
-- This migration promotes the config-blob taskId into a real FK column so
-- clients can join the two rows, keep them in sync, and eventually treat
-- them as one thing (see the app-side rewire that ships alongside this
-- migration).
--
-- Idempotent: uses `if not exists` on the column + `add if not exists`
-- semantics, and the backfill guards on `WHERE task_id IS NULL`.

-- 1. Column + FK.
--    public.tasks.id is int4 (bigserial-like sequence), not uuid.
--    Matching the parent type is required for the FK to be creatable.
alter table public.patient_care_plan_interventions
  add column if not exists task_id integer
    references public.tasks(id) on delete set null;

comment on column public.patient_care_plan_interventions.task_id is
  'FK to the tasks row that carries the assignee, due date, and completion state for this intervention. NULL for legacy rows created before the collapse; new writes always populate it.';

create index if not exists patient_care_plan_interventions_task_id_idx
  on public.patient_care_plan_interventions (task_id);

-- 2. Backfill from legacy `config.taskId` where it survives as JSON.
--    Legacy value shape is a plain integer string (matches tasks.id).
update public.patient_care_plan_interventions i
   set task_id = (i.config ->> 'taskId')::integer
 where i.task_id is null
   and i.config ? 'taskId'
   and (i.config ->> 'taskId') ~ '^[0-9]+$'
   and exists (
     select 1 from public.tasks t
      where t.id = (i.config ->> 'taskId')::integer
   );

-- 3. The legacy `config.taskId` value stays in place for older client
--    builds; new writes populate `task_id` directly and reads prefer it.
--    A future migration can strip `config.taskId` once every client reads
--    from `task_id` exclusively.
