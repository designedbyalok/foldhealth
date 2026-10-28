-- Demo coverage and claims for the patient app's Claims tab
-- (supabase/patient_claims_migration.sql). There is no payer feed yet, so
-- this fills the tables for the demo logins only: every profile linked to
-- demo.patient@fold.health (production) or patient.test@example.com (Dev).
-- Re-runnable: fixed ids per member, replaced on each run.
--
--   supabase db query --linked --project-ref <ref> --file scripts/demo/patient_claims_demo.sql
--
-- Kept out of supabase/ so tools that run supabase/*.sql as migrations skip it.
-- Every total adds up: claim = sum of its lines, responsibility = allowed - plan paid.

begin;

do $$
declare
  m text;
  yr integer := extract(year from current_date)::integer;
begin
  for m in
    select distinct pa.member_id
      from public.patient_accounts pa
      join auth.users u on u.id = pa.user_id
     where u.email in ('demo.patient@fold.health', 'patient.test@example.com')
  loop
    insert into public.patient_coverage (member_id, plan_name, plan_year, accumulators, cost_shares, source)
    values (m, 'Fold Health Gold PPO', yr,
      '[{"key":"individual_deductible","label":"Individual Deductible","in_spent":1800,"in_limit":3000,"out_spent":400,"out_limit":2000},
        {"key":"individual_oop","label":"Individual Out of Pocket","in_spent":2800,"in_limit":6000,"out_spent":1500,"out_limit":6000},
        {"key":"family_deductible","label":"Family Deductible","in_spent":2000,"in_limit":5000,"out_spent":1500,"out_limit":5000},
        {"key":"family_oop","label":"Family Out of Pocket","in_spent":2800,"in_limit":12000,"out_spent":2500,"out_limit":12000}]',
      '[{"service":"Primary Care","in_copay":20,"in_coinsurance":null,"out_copay":null,"out_coinsurance":50},
        {"service":"Specialist","in_copay":35,"in_coinsurance":null,"out_copay":null,"out_coinsurance":50},
        {"service":"Urgent Care","in_copay":50,"in_coinsurance":30,"out_copay":null,"out_coinsurance":50},
        {"service":"Emergency Room","in_copay":null,"in_coinsurance":40,"out_copay":null,"out_coinsurance":50}]',
      'demo')
    on conflict (member_id) do update
      set plan_name = excluded.plan_name, plan_year = excluded.plan_year, accumulators = excluded.accumulators,
          cost_shares = excluded.cost_shares, source = excluded.source, updated_at = now();

    delete from public.patient_claims where member_id = m and source = 'demo';

    insert into public.patient_claims (id, member_id, claim_number, provider_name, service_date, status, network,
                                       billed, allowed, plan_paid, member_copay, member_paid, source) values
      (m || '-demo-1', m, 'CLM-' || yr || '-001234', 'Springfield Medical Center', current_date - 13, 'pending', 'in', 250, 120, 0, 0, 0, 'demo'),
      (m || '-demo-2', m, 'CLM-' || yr || '-007891', 'Northwood Dental Group', current_date - 54, 'in_review', 'in', 300, 170, 85, 0, 0, 'demo'),
      (m || '-demo-3', m, 'CLM-' || yr || '-008342', 'City Hospital', current_date - 133, 'paid', 'in', 1200, 640, 455, 50, 0, 'demo'),
      (m || '-demo-4', m, 'CLM-' || yr || '-009917', 'Quest Diagnostics', current_date - 160, 'paid', 'out', 210, 95, 95, 0, 0, 'demo');

    insert into public.patient_claim_lines (id, claim_id, procedure_code, description, service_date,
                                            billed, allowed, plan_paid, member_copay, sort_order) values
      (m || '-demo-1-1', m || '-demo-1', '99213', 'Office visit, established patient', current_date - 13, 250, 120, 0, 0, 1),
      (m || '-demo-2-1', m || '-demo-2', 'D0120', 'Periodic oral exam', current_date - 54, 120, 70, 35, 0, 1),
      (m || '-demo-2-2', m || '-demo-2', 'D1110', 'Teeth cleaning', current_date - 54, 180, 100, 50, 0, 2),
      (m || '-demo-3-1', m || '-demo-3', '99285', 'Emergency department visit, high severity', current_date - 133, 900, 480, 340, 50, 1),
      (m || '-demo-3-2', m || '-demo-3', '71046', 'Chest X-ray, two views', current_date - 133, 300, 160, 115, 0, 2),
      (m || '-demo-4-1', m || '-demo-4', '80053', 'Comprehensive metabolic panel', current_date - 160, 120, 55, 55, 0, 1),
      (m || '-demo-4-2', m || '-demo-4', '83036', 'Hemoglobin A1c', current_date - 160, 90, 40, 40, 0, 2);
  end loop;
end;
$$;

-- Guard: every claim equals the sum of its lines.
do $$
begin
  if exists (
    select 1 from public.patient_claims c
      join (select claim_id, sum(billed) b, sum(allowed) a, sum(plan_paid) p, sum(member_copay) cp
              from public.patient_claim_lines group by claim_id) l on l.claim_id = c.id
     where c.source = 'demo' and (c.billed, c.allowed, c.plan_paid, c.member_copay) <> (l.b, l.a, l.p, l.cp)
  ) then
    raise exception 'Demo claim totals do not match their lines';
  end if;
end;
$$;

commit;
