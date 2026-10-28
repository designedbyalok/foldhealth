-- Care Tasks for the patient app (W5 in docs/features/patient-app-workflows.md).
-- Requires patient_accounts_migration.sql and staff_patient_portal_access_migration.sql.
--
--   • medicines: the profile's active patient_medications, grouped by time of
--     day from the sig; a patient (or staff viewing as them) ticks a dose and
--     it is logged in patient_medication_doses, so staff can see adherence
--   • education: patient-education interventions on the profile's care plans,
--     with the matching patient_education_content link when there is one
--   • forms: forms staff sent (patient_assessment_sends) that have no
--     completed response yet; the patient app fills and submits them here
--
-- As everywhere in the patient app, patients read nothing directly: these
-- SECURITY DEFINER functions check patient_can_access first.

begin;

create table if not exists public.patient_medication_doses (
  id               uuid primary key default gen_random_uuid(),
  member_id        text not null,
  medication_id    uuid not null references public.patient_medications (id) on delete cascade,
  dose_date        date not null,
  slot             text not null check (slot in ('morning', 'afternoon', 'evening', 'night', 'anytime', 'as_needed')),
  taken_at         timestamptz not null default now(),
  recorded_by      uuid default auth.uid(),
  recorded_by_name text,
  unique (medication_id, dose_date, slot)
);
create index if not exists patient_medication_doses_member_idx
  on public.patient_medication_doses (member_id, dose_date);

alter table public.patient_medication_doses enable row level security;
-- staff_only (restrictive) is added by the add_staff_only_policy event trigger.
drop policy if exists "Staff manage medication doses" on public.patient_medication_doses;
create policy "Staff manage medication doses" on public.patient_medication_doses
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Times of day a sig asks for. Sigs are free text ("1 tab • 2 times a day •
-- After Meal", "Twice a Day after Meals", "as needed for wheezing"), so this
-- reads the frequency and any named time, and falls back to 'anytime'.
create or replace function public._medication_slots(p_sig text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text := lower(coalesce(p_sig, ''));
  n integer;
begin
  if s ~ '(as needed|prn|when needed|if needed)' then return array['as_needed']; end if;
  n := case
    when s ~ '(\d+)\s*times?\s*(a|per|each)\s*day' then substring(s from '(\d+)\s*times?\s*(?:a|per|each)\s*day')::integer
    when s ~ '(four times|4x)' then 4
    when s ~ '(three times|thrice|3x)' then 3
    when s ~ '(twice|two times|2x|bid)' then 2
    when s ~ '(once|one time|every day|daily|1 every day|qd)' then 1
    else null end;
  if n is null then
    return case
      when s ~ '(bedtime|night)' then array['night']
      when s ~ 'evening' then array['evening']
      when s ~ 'afternoon' then array['afternoon']
      when s ~ 'morning' then array['morning']
      else array['anytime'] end;
  end if;
  if n = 1 then
    return case
      when s ~ '(bedtime|night)' then array['night']
      when s ~ 'evening' then array['evening']
      when s ~ 'afternoon' then array['afternoon']
      when s ~ 'any ?time' then array['anytime']
      else array['morning'] end;
  end if;
  if n = 2 then return array['morning', 'evening']; end if;
  if n = 3 then return array['morning', 'afternoon', 'evening']; end if;
  return array['morning', 'afternoon', 'evening', 'night'];
end;
$$;
revoke execute on function public._medication_slots(text) from public, anon, authenticated;

-- One day of care tasks for a profile:
--   { meds: [{ id, name, sig, slot, taken, taken_by }],
--     education: [{ id, title, url, assigned }],
--     forms: [{ send_id, form_id, name, sent_at, sent_by }] }
-- Education and forms are not dated, so they come back for today only.
create or replace function public.patient_care_tasks(p_member_id text, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  is_today boolean := p_date between current_date - 1 and current_date + 1;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'meds', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'name', m.name, 'sig', m.sig, 'slot', sl.slot,
               'taken', d.id is not null, 'taken_by', d.recorded_by_name)
             order by array_position(array['morning','afternoon','evening','night','anytime','as_needed'], sl.slot), m.name)
        from public.patient_medications m
        cross join lateral unnest(public._medication_slots(m.sig)) as sl(slot)
        left join public.patient_medication_doses d
          on d.medication_id = m.id and d.dose_date = p_date and d.slot = sl.slot
       where m.patient_id = p_member_id
         and m.status ilike 'active'), '[]'::jsonb),
    'education', case when not is_today then '[]'::jsonb else coalesce((
      select jsonb_agg(e order by e->>'title')
        from (
          select distinct on (lower(coalesce(i.patient_title, i.title)))
                 jsonb_build_object(
                   'id', i.id,
                   'title', coalesce(nullif(i.patient_title, ''), i.title),
                   'url', (select c.url from public.patient_education_content c
                            where lower(c.title) = lower(coalesce(nullif(i.patient_title, ''), i.title))
                              and c.url is not null limit 1),
                   'assigned', 'Assigned from your care plan') as e
            from public.patient_care_plan_interventions i
            join public.patient_care_plans p on p.id = i.plan_id
           where p.patient_id = p_member_id
             and p.status = 'active'
             and i.kind = 'patient-education'
             and i.retired_instance_id is null
             and coalesce(i.status, '') not in ('Met', 'Completed', 'Cancelled', 'Not Met')
           order by lower(coalesce(i.patient_title, i.title)), i.created_at
        ) x), '[]'::jsonb) end,
    'forms', case when not is_today then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'send_id', s.id, 'form_id', f.id, 'name', f.name,
               'sent_at', s.sent_at, 'sent_by', s.sent_by_name)
             order by s.sent_at)
        from public.patient_assessment_sends s
        join public.forms f on f.id = s.form_id
       where s.patient_id = p_member_id
         and not exists (
           select 1 from public.form_responses r
            where r.form_id = s.form_id
              and r.patient_id = p_member_id
              and r.status = 'completed'
              and coalesce(r.completed_at, r.created_at) >= s.sent_at)), '[]'::jsonb) end);
end;
$$;
revoke execute on function public.patient_care_tasks(text, date) from public, anon;
grant execute on function public.patient_care_tasks(text, date) to authenticated;

-- Ticks or unticks doses for one day. Only around today: past days are a
-- record, not something to fill in later.
create or replace function public.patient_set_doses_taken(
  p_member_id text, p_date date, p_doses jsonb, p_taken boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  who text;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_date not between current_date - 1 and current_date + 1 then
    raise exception 'Only today''s medicines can be marked' using errcode = '22023';
  end if;
  if p_taken then
    who := public._patient_sender_name(p_member_id);
    insert into public.patient_medication_doses (member_id, medication_id, dose_date, slot, recorded_by_name)
    select p_member_id, m.id, p_date, d.slot, who
      from jsonb_to_recordset(p_doses) as d(medication_id uuid, slot text)
      join public.patient_medications m on m.id = d.medication_id and m.patient_id = p_member_id
     where d.slot = any (public._medication_slots(m.sig))
    on conflict (medication_id, dose_date, slot) do nothing;
  else
    delete from public.patient_medication_doses x
     using jsonb_to_recordset(p_doses) as d(medication_id uuid, slot text)
     where x.member_id = p_member_id and x.dose_date = p_date
       and x.medication_id = d.medication_id and x.slot = d.slot;
  end if;
end;
$$;
revoke execute on function public.patient_set_doses_taken(text, date, jsonb, boolean) from public, anon;
grant execute on function public.patient_set_doses_taken(text, date, jsonb, boolean) to authenticated;

-- A form staff sent to this profile, to fill in the patient app.
create or replace function public.patient_form(p_member_id text, p_send_id uuid)
returns table (form_id bigint, name text, description text, schema jsonb, settings jsonb, scoring jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select f.id, f.name, f.description, f.schema, f.settings, f.scoring
      from public.patient_assessment_sends s
      join public.forms f on f.id = s.form_id
     where s.id = p_send_id and s.patient_id = p_member_id;
end;
$$;
revoke execute on function public.patient_form(text, uuid) from public, anon;
grant execute on function public.patient_form(text, uuid) to authenticated;

-- A completed response bumps forms.response_count, which fires this trigger.
-- updated_by references staff profiles, so only a caller with one is
-- stamped as the form's last editor (a patient submitting is not).
create or replace function public.touch_forms_updated()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce((select p.id from public.profiles p where p.id = auth.uid()), new.updated_by);
  return new;
end;
$$;

-- Saves a completed response to a sent form, keyed to the patient so staff
-- see it with the patient's other responses.
create or replace function public.patient_submit_form(
  p_member_id text, p_send_id uuid, p_answers jsonb, p_scores jsonb default '{}'::jsonb)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_form bigint;
  v_id bigint;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select s.form_id into v_form from public.patient_assessment_sends s
   where s.id = p_send_id and s.patient_id = p_member_id;
  if v_form is null then
    raise exception 'This form was not sent to you' using errcode = '22023';
  end if;
  if jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 200000 then
    raise exception 'Invalid answers' using errcode = '22023';
  end if;
  insert into public.form_responses (form_id, answers, scores, status, started_at, completed_at,
                                     answered_count, patient_id, created_by)
  values (v_form, p_answers, coalesce(p_scores, '{}'::jsonb), 'completed', now(), now(),
          (select count(*) from jsonb_each(p_answers) e where e.value not in ('null'::jsonb, '""'::jsonb, '[]'::jsonb)),
          -- created_by references staff profiles; patients have none.
          p_member_id, case when public.is_staff() then auth.uid() end)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.patient_submit_form(text, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.patient_submit_form(text, uuid, jsonb, jsonb) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_submit_form(text, uuid, jsonb, jsonb);
--   drop function if exists public.patient_form(text, uuid);
--   drop function if exists public.patient_set_doses_taken(text, date, jsonb, boolean);
--   drop function if exists public.patient_care_tasks(text, date);
--   drop function if exists public._medication_slots(text);
--   drop table if exists public.patient_medication_doses;
