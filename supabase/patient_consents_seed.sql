-- Seed for patient_consents_migration.sql. Run the migration first.
--
-- Consent states come from data we already have, not invented values:
--   all_patients.ccm_consent / apcm_consent = true  → a 'given' program
--   consent (verbal, captured when the row was created). false or null
--   leaves the scope with no record, so it reads as missing and billing for
--   that program stays blocked, which keeps the Phase 2A gates demoable.
--   Patients with any program consent also get a verbal 'call' consent.
--   TCPA (autodialed calls / texts) is given for roughly half of them,
--   picked by a stable hash of the id so re-runs give the same answer.
-- Preferences come from each p360_profiles row: language, plus its emails
-- and primary phone numbers as 'unverified' contact points.
--
-- Idempotent: only touches rows whose id starts with 'seed-' (consents) or
-- whose updated_by is 'seed' (preferences).
-- Ask Alok Kumar to run this seed on Supabase.

begin;

delete from public.patient_consents where id like 'seed-%';

insert into public.patient_consents
  (id, patient_id, scope_type, scope, status, method, captured_by, captured_by_role, captured_at, effective_on, note)
select 'seed-' || ap.id || '-' || lower(p.scope), ap.id, 'program', p.scope, 'given', 'verbal',
       'Care Team', 'Care Coordinator', coalesce(ap.created_at, now()), coalesce(ap.created_at, now())::date,
       'Imported from the All Patients consent flag'
from public.all_patients ap
cross join lateral (values ('CCM', ap.ccm_consent), ('APCM', ap.apcm_consent)) as p(scope, flag)
where p.flag is true;

insert into public.patient_consents
  (id, patient_id, scope_type, scope, status, method, captured_by, captured_by_role, captured_at, effective_on, note)
select 'seed-' || ap.id || '-' || c.scope, ap.id, 'channel', c.scope, 'given', 'verbal',
       'Care Team', 'Care Coordinator', coalesce(ap.created_at, now()), coalesce(ap.created_at, now())::date,
       'Imported with the program consent'
from public.all_patients ap
cross join lateral (values ('call'), ('tcpa')) as c(scope)
where (ap.ccm_consent is true or ap.apcm_consent is true)
  and (c.scope = 'call' or ('x' || substr(md5(ap.id), 1, 8))::bit(32)::int % 2 = 0);

delete from public.patient_preferences where updated_by = 'seed';

insert into public.patient_preferences
  (patient_id, preferred_language, contact_points, updated_by)
select pp.patient_id,
       coalesce(nullif(pp.primary_language, ''), nullif(pp.language_preference, '')),
       coalesce((
         select jsonb_agg(jsonb_build_object('kind', x.kind, 'value', x.value, 'status', 'unverified'))
         from (
           select 'email' as kind, e #>> '{}' as value from jsonb_array_elements(coalesce(pp.emails, '[]'::jsonb)) e
           union all
           select 'phone', n #>> '{}' from jsonb_array_elements(coalesce(pp.plan_numbers_primary, '[]'::jsonb)) n
         ) x
         where coalesce(x.value, '') <> ''
       ), '[]'::jsonb),
       'seed'
from public.p360_profiles pp
on conflict (patient_id) do nothing;

commit;
