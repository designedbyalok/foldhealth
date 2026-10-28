-- Claims and coverage for the patient app (W10 in docs/features/patient-app-workflows.md).
-- Requires patient_accounts_migration.sql.
--
-- There is no payer or clearinghouse feed yet. These tables hold what one
-- would provide (eligibility 271 for coverage, 835 remittance for claims and
-- EOB lines), so a feed can fill them later; until then demo rows fill them.
--
--   • patient_coverage: one row per member. accumulators = deductible and
--     out-of-pocket progress, in and out of network, each against its limit;
--     cost_shares = copay and coinsurance per kind of visit
--   • patient_claims and patient_claim_lines (the Explanation of Benefits)
--
-- Member responsibility is never stored as a free number: it is allowed
-- minus plan paid, so the patient can't be shown figures that don't add up
-- (the Figma samples do not). Balance owed = responsibility minus what the
-- member already paid.

begin;

create table if not exists public.patient_coverage (
  member_id    text primary key,
  plan_name    text not null,
  plan_year    integer not null,
  -- [{ key, label, in_spent, in_limit, out_spent, out_limit }]
  accumulators jsonb not null default '[]'::jsonb,
  -- [{ service, in_copay, in_coinsurance, out_copay, out_coinsurance }] (null = not applicable)
  cost_shares  jsonb not null default '[]'::jsonb,
  source       text not null default 'manual',
  updated_at   timestamptz not null default now()
);

create table if not exists public.patient_claims (
  id             text primary key,
  member_id      text not null,
  claim_number   text not null,
  provider_name  text not null,
  service_date   date not null,
  status         text not null check (status in ('pending', 'submitted', 'in_review', 'paid', 'rejected')),
  network        text not null default 'in' check (network in ('in', 'out')),
  billed         numeric(10, 2) not null default 0,
  allowed        numeric(10, 2) not null default 0,
  plan_paid      numeric(10, 2) not null default 0,
  member_copay   numeric(10, 2) not null default 0,
  member_paid    numeric(10, 2) not null default 0,
  member_responsibility numeric(10, 2) generated always as (greatest(allowed - plan_paid, 0)) stored,
  source         text not null default 'manual',
  created_at     timestamptz not null default now(),
  check (allowed <= billed and plan_paid <= allowed and member_copay <= allowed - plan_paid)
);
create index if not exists patient_claims_member_idx on public.patient_claims (member_id, service_date desc);

create table if not exists public.patient_claim_lines (
  id             text primary key,
  claim_id       text not null references public.patient_claims (id) on delete cascade,
  procedure_code text not null,
  description    text not null,
  service_date   date not null,
  billed         numeric(10, 2) not null default 0,
  allowed        numeric(10, 2) not null default 0,
  plan_paid      numeric(10, 2) not null default 0,
  member_copay   numeric(10, 2) not null default 0,
  member_responsibility numeric(10, 2) generated always as (greatest(allowed - plan_paid, 0)) stored,
  sort_order     integer not null default 0,
  check (allowed <= billed and plan_paid <= allowed and member_copay <= allowed - plan_paid)
);
create index if not exists patient_claim_lines_claim_idx on public.patient_claim_lines (claim_id, sort_order);

alter table public.patient_coverage enable row level security;
alter table public.patient_claims enable row level security;
alter table public.patient_claim_lines enable row level security;
-- staff_only (restrictive) is added by the add_staff_only_policy event trigger.
drop policy if exists "Staff manage coverage" on public.patient_coverage;
create policy "Staff manage coverage" on public.patient_coverage
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "Staff manage claims" on public.patient_claims;
create policy "Staff manage claims" on public.patient_claims
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "Staff manage claim lines" on public.patient_claim_lines;
create policy "Staff manage claim lines" on public.patient_claim_lines
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Coverage overview for a profile, or null when none is on file.
create or replace function public.patient_coverage_for(p_member_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (select jsonb_build_object('plan_name', c.plan_name, 'plan_year', c.plan_year,
                                    'accumulators', c.accumulators, 'cost_shares', c.cost_shares,
                                    'updated_at', c.updated_at)
            from public.patient_coverage c where c.member_id = p_member_id);
end;
$$;
revoke execute on function public.patient_coverage_for(text) from public, anon;
grant execute on function public.patient_coverage_for(text) to authenticated;

-- A profile's claims, each with its EOB lines.
create or replace function public.patient_claims_for(p_member_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'claim_number', c.claim_number, 'provider_name', c.provider_name,
             'service_date', c.service_date, 'status', c.status, 'network', c.network,
             'billed', c.billed, 'allowed', c.allowed, 'plan_paid', c.plan_paid,
             'member_copay', c.member_copay, 'member_responsibility', c.member_responsibility,
             'balance_owed', greatest(c.member_responsibility - c.member_paid, 0),
             'patient_name', (select a.name from public.all_patients a where a.member_id = c.member_id
                               order by a.updated_at desc nulls last limit 1),
             'lines', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'procedure_code', l.procedure_code, 'description', l.description,
                        'service_date', l.service_date, 'billed', l.billed, 'allowed', l.allowed,
                        'plan_paid', l.plan_paid, 'member_copay', l.member_copay,
                        'member_responsibility', l.member_responsibility) order by l.sort_order)
                 from public.patient_claim_lines l where l.claim_id = c.id), '[]'::jsonb))
           order by c.service_date desc)
      from public.patient_claims c
     where c.member_id = p_member_id), '[]'::jsonb);
end;
$$;
revoke execute on function public.patient_claims_for(text) from public, anon;
grant execute on function public.patient_claims_for(text) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_claims_for(text);
--   drop function if exists public.patient_coverage_for(text);
--   drop table if exists public.patient_claim_lines;
--   drop table if exists public.patient_claims;
--   drop table if exists public.patient_coverage;
