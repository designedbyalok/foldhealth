-- Edit Profile for the patient app (W4 in docs/features/patient-app-workflows.md).
-- Requires patient_accounts_migration.sql and staff_patient_portal_access_migration.sql.
--
-- A patient changes their own contact details; name, date of birth and
-- gender stay with the care team. Changes land where the staff app reads
-- them, so there is nothing to sync:
--   • email, phone, secondary email and phone, address → p360_profiles
--     (emails[], plan_numbers_primary[], plan_numbers_secondary[],
--     address_line1/2, city, state, zipcode), also mirrored to all_patients
--     and patients so lists show the same values
--   • preferred contact method → patient_preferences.preferred_contact_method
--   • "consent to electronic communication" → channel consents (email, sms,
--     call) in patient_consents, method e_sign, captured by the patient
-- Every changed field is logged in patient_profile_changes.

begin;

alter table public.patient_preferences
  add column if not exists preferred_contact_method text
  check (preferred_contact_method in ('email', 'call', 'sms'));

create table if not exists public.patient_profile_changes (
  id              uuid primary key default gen_random_uuid(),
  member_id       text not null,
  field           text not null,
  old_value       text,
  new_value       text,
  changed_by      uuid default auth.uid(),
  changed_by_name text,
  changed_at      timestamptz not null default now()
);
create index if not exists patient_profile_changes_member_idx
  on public.patient_profile_changes (member_id, changed_at desc);

alter table public.patient_profile_changes enable row level security;
-- staff_only (restrictive) is added by the add_staff_only_policy event trigger.
drop policy if exists "Staff read profile changes" on public.patient_profile_changes;
create policy "Staff read profile changes" on public.patient_profile_changes
  for select to authenticated using ((select public.is_staff()));

-- Current e-communication consent: every channel's newest record is 'given'.
create or replace function public._patient_e_consent(p_member_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select count(*) = 3 and bool_and(c.status = 'given')
    from (
      select distinct on (pc.scope) pc.scope, pc.status
        from public.patient_consents pc
       where pc.patient_id = p_member_id and pc.scope_type = 'channel' and pc.scope in ('email', 'sms', 'call')
       order by pc.scope, pc.captured_at desc
    ) c;
$$;
revoke execute on function public._patient_e_consent(text) from public, anon, authenticated;

-- The profile as the Edit Profile drawer shows it.
create or replace function public.patient_contact_profile(p_member_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ap record;
  pp record;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select a.name, a.dob, a.gender, a.email, a.phone, a.city, a.state, a.zip into ap
    from public.all_patients a where a.member_id = p_member_id
   order by a.updated_at desc nulls last limit 1;
  select * into pp from public.p360_profiles p where p.patient_id = p_member_id limit 1;
  return jsonb_build_object(
    'name', ap.name,
    'dob', coalesce(pp.date_of_birth::text, ap.dob::text),
    'gender', ap.gender,
    'email', coalesce(pp.emails->>0, ap.email),
    'secondary_email', pp.emails->>1,
    'phone', coalesce(pp.plan_numbers_primary->>0, ap.phone),
    'secondary_phone', pp.plan_numbers_secondary->>0,
    'address_line1', pp.address_line1,
    'address_line2', pp.address_line2,
    'city', coalesce(pp.city, ap.city),
    'state', coalesce(pp.state, ap.state),
    'zipcode', coalesce(pp.zipcode, ap.zip),
    'preferred_contact_method', (select pr.preferred_contact_method from public.patient_preferences pr where pr.patient_id = p_member_id),
    'e_consent', coalesce(public._patient_e_consent(p_member_id), false));
end;
$$;
revoke execute on function public.patient_contact_profile(text) from public, anon;
grant execute on function public.patient_contact_profile(text) to authenticated;

-- Saves contact details. p_changes holds only the fields being changed:
-- email, secondary_email, phone, secondary_phone, address_line1,
-- address_line2, city, state, zipcode, preferred_contact_method, e_consent.
create or replace function public.patient_update_contact(p_member_id text, p_changes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  before jsonb := public.patient_contact_profile(p_member_id);
  after jsonb;
  who text := public._patient_sender_name(p_member_id);
  k text;
  v text;
  allowed text[] := array['email', 'secondary_email', 'phone', 'secondary_phone', 'address_line1', 'address_line2',
                          'city', 'state', 'zipcode', 'preferred_contact_method', 'e_consent'];
  v_emails jsonb;
begin
  if jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Invalid changes' using errcode = '22023';
  end if;
  for k, v in select key, nullif(btrim(value #>> '{}'), '') from jsonb_each(p_changes) loop
    if not k = any (allowed) then
      raise exception 'You can''t change %', k using errcode = '42501';
    end if;
    if length(v) > 200 then
      raise exception '% is too long', replace(k, '_', ' ') using errcode = '22023';
    end if;
    if k in ('email', 'secondary_email') and v is not null and v !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Enter a valid email address' using errcode = '22023';
    end if;
    if k in ('phone', 'secondary_phone') and v is not null and length(regexp_replace(v, '\D', '', 'g')) not between 10 and 15 then
      raise exception 'Enter a valid phone number' using errcode = '22023';
    end if;
    if k = 'zipcode' and v is not null and v !~ '^\d{5}(-?\d{4})?$' then
      raise exception 'Enter a 5-digit zip code' using errcode = '22023';
    end if;
    if k = 'preferred_contact_method' and v is not null and v not in ('email', 'call', 'sms') then
      raise exception 'Unknown contact method' using errcode = '22023';
    end if;
  end loop;
  if p_changes ? 'email' and nullif(btrim(p_changes->>'email'), '') is null then
    raise exception 'An email address is required' using errcode = '22023';
  end if;
  if p_changes ? 'phone' and nullif(btrim(p_changes->>'phone'), '') is null then
    raise exception 'A phone number is required' using errcode = '22023';
  end if;

  after := before || (select jsonb_object_agg(key, case when key = 'e_consent' then value
                                                        else to_jsonb(nullif(btrim(value #>> '{}'), '')) end)
                        from jsonb_each(p_changes));

  -- p360_profiles: the staff Profile tab's source for contact details.
  -- Positional: [primary, secondary]; the primary slot stays even when empty
  -- so a secondary email never reads back as the primary.
  v_emails := case
    when after->>'secondary_email' is not null then jsonb_build_array(after->>'email', after->>'secondary_email')
    when after->>'email' is not null then jsonb_build_array(after->>'email')
    else '[]'::jsonb end;
  if exists (select 1 from public.p360_profiles where patient_id = p_member_id) then
    update public.p360_profiles set
      emails = v_emails,
      plan_numbers_primary = case when after->>'phone' is null then '[]'::jsonb else jsonb_build_array(after->>'phone') end,
      plan_numbers_secondary = case when after->>'secondary_phone' is null then '[]'::jsonb else jsonb_build_array(after->>'secondary_phone') end,
      address_line1 = after->>'address_line1',
      address_line2 = after->>'address_line2',
      city = after->>'city',
      state = after->>'state',
      zipcode = after->>'zipcode',
      updated_at = now()
     where patient_id = p_member_id;
  else
    insert into public.p360_profiles (patient_id, emails, plan_numbers_primary, plan_numbers_secondary,
                                      address_line1, address_line2, city, state, zipcode)
    values (p_member_id, v_emails,
            case when after->>'phone' is null then '[]'::jsonb else jsonb_build_array(after->>'phone') end,
            case when after->>'secondary_phone' is null then '[]'::jsonb else jsonb_build_array(after->>'secondary_phone') end,
            after->>'address_line1', after->>'address_line2', after->>'city', after->>'state', after->>'zipcode');
  end if;
  update public.all_patients set email = after->>'email', phone = after->>'phone', city = after->>'city',
                                 state = after->>'state', zip = after->>'zipcode', updated_at = now()
   where member_id = p_member_id;
  update public.patients set email = after->>'email', phone = after->>'phone', city = after->>'city',
                             state = after->>'state'
   where member_id = p_member_id;

  if p_changes ? 'preferred_contact_method' then
    insert into public.patient_preferences (patient_id, preferred_contact_method, updated_by, updated_at)
    values (p_member_id, after->>'preferred_contact_method', who, now())
    on conflict (patient_id) do update
      set preferred_contact_method = excluded.preferred_contact_method, updated_by = excluded.updated_by, updated_at = now();
  end if;

  if p_changes ? 'e_consent' and (after->'e_consent') is distinct from (before->'e_consent') then
    insert into public.patient_consents (id, patient_id, scope_type, scope, status, method, captured_by,
                                         captured_by_role, captured_at, effective_on, note)
    select gen_random_uuid()::text, p_member_id, 'channel', ch,
           case when (after->>'e_consent')::boolean then 'given' else 'withdrawn' end,
           case when (after->>'e_consent')::boolean then 'e_sign' end,
           who, case when public.is_staff() then 'staff' else 'patient' end, now(), current_date,
           'Set in the patient app (Edit Profile)'
      from unnest(array['email', 'sms', 'call']) ch;
  end if;

  insert into public.patient_profile_changes (member_id, field, old_value, new_value, changed_by_name)
  select p_member_id, c.key, before->>c.key, after->>c.key, who
    from jsonb_each(p_changes) c
   where (before->c.key) is distinct from (after->c.key);

  return public.patient_contact_profile(p_member_id);
end;
$$;
revoke execute on function public.patient_update_contact(text, jsonb) from public, anon;
grant execute on function public.patient_update_contact(text, jsonb) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_update_contact(text, jsonb);
--   drop function if exists public.patient_contact_profile(text);
--   drop function if exists public._patient_e_consent(text);
--   drop table if exists public.patient_profile_changes;
--   alter table public.patient_preferences drop column if exists preferred_contact_method;
