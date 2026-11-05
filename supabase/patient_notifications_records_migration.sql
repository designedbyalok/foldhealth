-- Patient app notifications (W9) and health records (W6), see
-- docs/features/patient-app-workflows.md. Requires
-- patient_accounts_migration.sql, patient_appointments_migration.sql and
-- patient_messages_migration.sql.
--
-- Notifications are derived, not stored: care-team messages from the last
-- 14 days (unread until the patient opens the thread) and visits today or
-- tomorrow. Assessments join the feed once patients can fill forms (W5).
--
-- Health records are read-only and leave out the clinician `note` fields,
-- which can hold internal clinical text. Only active medications are shown.

begin;

create or replace function public.patient_notifications(p_member_id text)
returns table (id text, kind text, title text, body text, at timestamptz,
               unread boolean, conversation_id uuid)
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
    (select 'msg:' || m.id::text, 'message'::text,
            'New message from ' || coalesce(nullif(m.sender_name, ''), 'your care team'),
            left(regexp_replace(coalesce(nullif(m.body, ''), 'Sent an attachment'), '\s+', ' ', 'g'), 140),
            m.created_at, m.read_at is null, c.id
       from public.patient_messages m
       join public.patient_conversations c on c.id = m.conversation_id
      where c.channel = 'chat' and c.patient_id = p_member_id
        and m.direction = 'out' and public._patient_visible_message(m)
        and m.created_at > now() - interval '14 days'
      order by m.created_at desc
      limit 30)
    union all
    (select 'appt:' || a.id::text, 'appointment'::text,
            case when public.appointment_wall(a.date, a.time_start)::date = current_date
                 then 'You have a visit today' else 'You have a visit tomorrow' end,
            concat_ws(' • ', a.appointment_type_name, nullif('with ' || coalesce(a.primary_user, ''), 'with '), upper(a.time_start)),
            now(), false, null::uuid
       from public.appointments a
      where a.patient_id = p_member_id
        and coalesce(a.status, '') not in ('Cancelled', 'Canceled', 'Completed', 'No Show')
        and public.appointment_wall(a.date, a.time_start)::date between current_date and current_date + 1);
end;
$$;

create or replace function public.patient_health_records(p_member_id text)
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
  return jsonb_build_object(
    'problems', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'title', p.title, 'status', p.status, 'severity', p.severity,
               'since', p.onset_label, 'type', p.problem_type)
             order by (p.status = 'Active') desc, p.sort_order nulls last, p.title)
        from public.patient_problems p
       where p.patient_id = p_member_id), '[]'::jsonb),
    'allergies', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'title', a.title, 'criticality', a.criticality, 'since', a.since_date,
               'reactions', coalesce((select jsonb_agg(r->>'display')
                                        from jsonb_array_elements(case when jsonb_typeof(a.reactions) = 'array' then a.reactions else '[]'::jsonb end) r
                                       where coalesce(r->>'display', '') <> ''), '[]'::jsonb))
             order by a.sort_order nulls last, a.title)
        from public.patient_allergies a
       where a.patient_id = p_member_id
         and coalesce(a.status, '') not in ('Inactive', 'Entered in Error')), '[]'::jsonb),
    'medications', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'sig', m.sig, 'since', m.start_date)
             order by m.name)
        from public.patient_medications m
       where m.patient_id = p_member_id and m.status = 'Active'), '[]'::jsonb),
    'immunizations', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'status', i.status, 'date', i.date_administered)
             order by i.sort_order nulls last, i.title)
        from public.patient_immunizations i
       where i.patient_id = p_member_id
         and coalesce(i.status, '') <> 'Entered in Error'), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.patient_notifications(text) from public, anon;
grant execute on function public.patient_notifications(text) to authenticated;
revoke execute on function public.patient_health_records(text) from public, anon;
grant execute on function public.patient_health_records(text) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_health_records(text);
--   drop function if exists public.patient_notifications(text);
