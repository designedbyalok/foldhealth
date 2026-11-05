-- Pharmacy gap status model (spec: "Pharmacy Workflow: Gap & Medication
-- Status Model, Claim Reversal and Worklist Columns", Oct 24 2026).
--
-- Gap statuses are derived client-side (pharmacyWorklist.utils.js); this
-- migration only adds the data they read and retires the old values.
--
-- 1. Eligibility on each member (eligibility file): a Termed member's gaps
--    are Not Eligible.
--      eligibility_status  Active | Termed
--      term_date           MM/DD/YYYY, when termed
-- 2. pharmacy_plan_timers: the claim timers per health plan, set once
--    Astrana shares each feed's frequency and lag.
--      match_window_days     how long a projected fill waits for its claim
--      feed_lag_days         plan feed lag, added to the reversal watch
--      return_to_stock_days  shelf time before a fill is returned (~14)
--      refill_due_days       outreach window before Next Fill Due
--    Plans with no row use the defaults in planTimers().
-- 3. Old statuses retired: Completed becomes Pending Claim, Closed-Data
--    becomes Closed, on the member row and on each gap in `measures`. A
--    status set by hand is kept only when it is Open or In Progress, the
--    only statuses the team can set.
--
-- Run before pharmacy_status_model_seed.sql. Safe to run more than once.

begin;

-- 1. Eligibility
alter table public.pharmacy_worklist_members
  add column if not exists eligibility_status text not null default 'Active',
  add column if not exists term_date text;

alter table public.pharmacy_worklist_members
  drop constraint if exists pharmacy_worklist_members_eligibility_status_check;
alter table public.pharmacy_worklist_members
  add constraint pharmacy_worklist_members_eligibility_status_check
  check (eligibility_status in ('Active', 'Termed'));

-- 2. Claim timers per health plan
create table if not exists public.pharmacy_plan_timers (
  health_plan           text primary key,
  match_window_days     integer not null default 14 check (match_window_days > 0),
  feed_lag_days         integer not null default 7 check (feed_lag_days >= 0),
  return_to_stock_days  integer not null default 14 check (return_to_stock_days > 0),
  refill_due_days       integer not null default 14 check (refill_due_days >= 0),
  note                  text,
  updated_at            timestamptz not null default now()
);

alter table public.pharmacy_plan_timers enable row level security;

drop policy if exists pharmacy_plan_timers_select on public.pharmacy_plan_timers;
create policy pharmacy_plan_timers_select
  on public.pharmacy_plan_timers for select to authenticated
  using (true);

drop policy if exists pharmacy_plan_timers_write on public.pharmacy_plan_timers;
create policy pharmacy_plan_timers_write
  on public.pharmacy_plan_timers for all to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'Active'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'Active'
  ));

-- 3. Retire Completed / Closed-Data
update public.pharmacy_worklist_members
set status = case status when 'Completed' then 'Pending Claim' when 'Closed-Data' then 'Closed' else status end,
    status_manual = status_manual and status in ('Open', 'In Progress')
where status in ('Completed', 'Closed-Data')
   or (status_manual and status not in ('Open', 'In Progress'));

update public.pharmacy_worklist_members as m
set measures = (
  select coalesce(jsonb_agg(
    case
      when e ->> 'status' in ('Completed', 'Closed-Data')
        then (e - 'statusManual') || jsonb_build_object('status', case e ->> 'status' when 'Completed' then 'Pending Claim' else 'Closed' end)
      when (e ->> 'statusManual')::boolean and coalesce(e ->> 'status', '') not in ('Open', 'In Progress')
        then e - 'statusManual'
      else e
    end
    order by i), '[]'::jsonb)
  from jsonb_array_elements(m.measures) with ordinality as t(e, i)
)
where exists (
  select 1 from jsonb_array_elements(m.measures) as e
  where e ->> 'status' in ('Completed', 'Closed-Data')
     or ((e ->> 'statusManual')::boolean and coalesce(e ->> 'status', '') not in ('Open', 'In Progress'))
);

commit;
