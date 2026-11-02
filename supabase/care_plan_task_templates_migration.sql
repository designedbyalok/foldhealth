-- Task templates on care plan templates.
--
-- A Patient Task or Internal Task entry on a care plan template carries its
-- task template in the entry's `config`: title, priority, labels, assignee
-- role (assigneeRole), fallback pool (pool), creation timing and trigger, and
-- the SLA (dueOffset + dueUnit + durationType). When the template is applied,
-- each plan intervention keeps a pointer back to its entry in
-- config.taskTemplate = { templateId, entryId }.
--
-- spawn_care_plan_tasks() turns those plan interventions into real tasks once
-- their creation date arrives. It reads the template entry as it is NOW, so an
-- edited task template changes every task not yet created, and tasks already
-- created are left alone. The app calls it after applying a template and after
-- signing a plan; pg_cron runs it nightly for tasks whose creation is delayed.
--
-- Routing: Internal Task goes to the patient's current care team member who
-- holds the role, else a named assignee if the entry has one, else unassigned
-- in the pool (default Care Management). Patient Task goes to the member.
-- Interventions applied before this migration have no pointer and never spawn.

create or replace function public.add_business_days(d date, n integer)
returns date
language sql
immutable
as $$
  select case when n <= 0 then d else (
    select x::date
    from generate_series(d + 1, d + n * 2 + 7, interval '1 day') x
    where extract(isodow from x) < 6
    order by x
    offset n - 1 limit 1
  ) end
$$;

create or replace function public.spawn_care_plan_tasks(p_plan_id uuid default null)
returns integer
language plpgsql
set search_path = public
as $$
declare
  r record;
  live jsonb;
  cfg jsonb;
  title text;
  trig text;
  anchor date;
  starts date;
  n integer;
  due date;
  today date := (now() at time zone 'America/Los_Angeles')::date;
  member_name text;
  owner_name text;
  owner_id uuid;
  task_pool text;
  new_id integer;
  made integer := 0;
begin
  for r in
    select i.id, i.kind, i.title, i.priority, i.config,
           p.patient_id, p.program_code, p.signed_at,
           pr.start_date as program_start, pr.trigger_date as program_trigger,
           t.interventions as tpl_interventions, t.categories as tpl_categories
    from patient_care_plan_interventions i
    join patient_care_plans p on p.id = i.plan_id
    left join patient_care_programs pr on pr.id = p.program_id
    left join care_plan_templates t on t.id::text = i.config->'taskTemplate'->>'templateId'
    where i.task_id is null
      and i.retired_instance_id is null
      and i.kind in ('patient-task', 'internal-task')
      and i.config ? 'taskTemplate'
      and coalesce(i.status, 'Not Started') not in ('Met', 'UTR')
      and coalesce(p.status, 'active') <> 'paused'
      and pr.closed_at is null
      and (p_plan_id is null or i.plan_id = p_plan_id)
    for update of i skip locked
  loop
    -- The entry as the template has it now; a removed entry falls back to the
    -- copy the plan took when the template was applied.
    select e into live
    from (
      select jsonb_array_elements(coalesce(r.tpl_interventions, '[]'::jsonb)) e
      union all
      select jsonb_array_elements(coalesce(c->'interventions', '[]'::jsonb))
      from jsonb_array_elements(coalesce(r.tpl_categories, '[]'::jsonb)) c
    ) s
    where e->>'id' = r.config->'taskTemplate'->>'entryId'
    limit 1;
    cfg := coalesce(r.config, '{}'::jsonb) || coalesce(live->'config', '{}'::jsonb);
    title := coalesce(nullif(trim(live->>'title'), ''), r.title);

    trig := coalesce(nullif(cfg->>'creationTrigger', ''), 'Care Plan Signed');
    anchor := case trig
      when 'Care Plan Signed' then (r.signed_at at time zone 'America/Los_Angeles')::date
      when 'Program Start Date' then case when r.program_start ~ '^\d{2}/\d{2}/\d{4}$' then to_date(r.program_start, 'MM/DD/YYYY') end
      when 'Discharge Date' then case when r.program_trigger ~ '^\d{2}/\d{2}/\d{4}$' then to_date(r.program_trigger, 'MM/DD/YYYY') end
    end;
    continue when anchor is null;
    n := coalesce(nullif(regexp_replace(coalesce(cfg->>'creationCount', ''), '\D', '', 'g'), '')::integer, 1);
    starts := anchor + case cfg->>'creationTiming'
      when 'day' then n
      when 'week' then n * 7
      else 0
    end;
    continue when starts > today;

    -- SLA counts from the day the task actually lands on a queue.
    n := coalesce(nullif(regexp_replace(coalesce(cfg->>'dueOffset', ''), '\D', '', 'g'), '')::integer, 7);
    if cfg->>'dueUnit' = 'week' then
      n := n * case when cfg->>'durationType' = 'business' then 5 else 7 end;
    end if;
    due := case when cfg->>'durationType' = 'business' then add_business_days(today, n) else today + n end;

    select name into member_name from patients
    where id::text = r.patient_id or member_id = r.patient_id
    limit 1;

    owner_name := null; owner_id := null; task_pool := null;
    if r.kind = 'patient-task' then
      owner_name := member_name;
    else
      if nullif(cfg->>'assigneeRole', '') is not null then
        select ct.name, case when ct.user_id ~* '^[0-9a-f-]{36}$' then ct.user_id::uuid end
          into owner_name, owner_id
        from patient_care_team ct
        where ct.patient_id = r.patient_id and ct.status = 'current' and ct.role = cfg->>'assigneeRole'
        order by ct.sort_order, ct.created_at
        limit 1;
      end if;
      if owner_name is null and nullif(cfg->>'assignedTo', '') is not null then
        owner_name := cfg->>'assignedTo';
        select pf.id into owner_id from profiles pf where pf.full_name = owner_name limit 1;
      end if;
      if owner_name is null then
        task_pool := coalesce(nullif(cfg->>'pool', ''), 'Care Management');
      end if;
    end if;

    new_id := null;
    insert into tasks (
      name, status, priority, due_date, assigned_to, assigned_to_id, member,
      labels, meta, description, pool, mentions, attachments, comments,
      is_subtask, created_by, patient_id, program_code, source_key
    ) values (
      left(title, 150), 'pending',
      case lower(coalesce(cfg->>'priority', r.priority)) when 'high' then 'high' when 'low' then 'low' else 'medium' end,
      to_char(due, 'MM/DD/YYYY'), owner_name, owner_id, coalesce(member_name, r.patient_id),
      coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(cfg->'labels') = 'array' then cfg->'labels' else '[]'::jsonb end)), '{}'),
      case when task_pool is not null then 'Pool : ' || task_pool else '' end,
      coalesce(cfg->>'description', ''), task_pool, '{}', 0, 0,
      false, 'System', r.patient_id, r.program_code, 'care-plan-intervention:' || r.id
    )
    on conflict (source_key) where source_key is not null do nothing
    returning id into new_id;

    if new_id is null then
      select id into new_id from tasks where source_key = 'care-plan-intervention:' || r.id;
    else
      made := made + 1;
    end if;

    update patient_care_plan_interventions
    set task_id = new_id,
        assignee_name = coalesce(owner_name, task_pool, assignee_name),
        assignee_initials = case when owner_name is not null
          then upper(left(split_part(owner_name, ' ', 1), 1) || left(split_part(owner_name, ' ', 2), 1))
          else assignee_initials end,
        updated_at = now()
    where id = r.id;
  end loop;
  return made;
end;
$$;

revoke all on function public.spawn_care_plan_tasks(uuid) from public, anon;
grant execute on function public.spawn_care_plan_tasks(uuid) to authenticated;

-- Nightly, after close-due-care-plan-episodes (09:00 UTC), for tasks whose
-- creation date is days after their trigger.
select cron.unschedule('spawn-care-plan-tasks')
where exists (select 1 from cron.job where jobname = 'spawn-care-plan-tasks');
select cron.schedule('spawn-care-plan-tasks', '15 9 * * *', $$select public.spawn_care_plan_tasks()$$);
