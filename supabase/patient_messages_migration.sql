-- Patients message their care team from the patient app (W8 in
-- docs/features/patient-app-workflows.md). Requires
-- patient_accounts_migration.sql and patient_conversations_migration.sql.
--
-- Same conversations staff already use in Messages > Chat
-- (patient_conversations with channel 'chat', patient_messages): a staff
-- reply shows in the patient app and a patient message lands in the staff
-- inbox as unread. These functions are the member-keyed twins of the
-- token-based comms_patient_* ones: they check patient_can_access instead of
-- a link token, and show the patient only what that page shows: chat
-- messages, never internal notes, drafts, call logs or emails.
--
-- Who wrote a patient-side message: the patient's own account writes as the
-- patient; a parent, guardian or caregiver writes as "<email> (caregiver)"
-- so staff know it isn't the patient. meta.sent_by_user_id keeps the account.

begin;

-- The care team on the patient's profile (p360_profiles.care_team).
create or replace function public.patient_care_team(p_member_id text)
returns table (name text, title text, role text, initials text)
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
    select t->>'name', nullif(t->>'title', ''), nullif(t->>'role', ''), nullif(t->>'initials', '')
      from public.p360_profiles p,
           jsonb_array_elements(case when jsonb_typeof(p.care_team) = 'array' then p.care_team else '[]'::jsonb end) t
     where p.patient_id = p_member_id
       and coalesce(t->>'name', '') <> '';
end;
$$;

-- What a patient may see of a conversation's messages.
create or replace function public._patient_visible_message(m public.patient_messages)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select m.kind = 'message' and not m.internal and m.status <> 'draft';
$$;

-- The profile's chat conversations, newest first. Preview, time and unread
-- count come from visible messages only.
create or replace function public.patient_conversations(p_member_id text)
returns table (id uuid, title text, member_names text[], last_preview text,
               last_message_at timestamptz, unread integer)
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
    select c.id,
           coalesce(nullif(c.group_name, ''), nullif(c.subject, ''), 'Your care team'),
           coalesce((select array_agg(mem->>'name')
                       from jsonb_array_elements(case when jsonb_typeof(c.members) = 'array' then c.members else '[]'::jsonb end) mem
                      where coalesce(mem->>'name', '') <> ''), '{}'),
           coalesce(last_m.preview, ''),
           coalesce(last_m.created_at, c.created_at),
           (select count(*)::int from public.patient_messages m
             where m.conversation_id = c.id and m.direction = 'out'
               and public._patient_visible_message(m) and m.read_at is null)
      from public.patient_conversations c
      left join lateral (
        select left(regexp_replace(coalesce(nullif(m.body, ''), case when m.meta ? 'attachment' then 'Sent an attachment' end, ''), '\s+', ' ', 'g'), 140) preview,
               m.created_at
          from public.patient_messages m
         where m.conversation_id = c.id and public._patient_visible_message(m)
         order by m.created_at desc
         limit 1
      ) last_m on true
     where c.channel = 'chat' and c.patient_id = p_member_id
     order by coalesce(last_m.created_at, c.created_at) desc;
end;
$$;

-- One conversation's visible messages, oldest first.
create or replace function public.patient_conversation_messages(p_member_id text, p_conversation_id uuid)
returns table (id uuid, direction text, sender_name text, body text, attachment_name text,
               status text, read_at timestamptz, created_at timestamptz)
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
    select m.id, m.direction, m.sender_name, m.body, m.meta->'attachment'->>'name',
           m.status, m.read_at, m.created_at
      from public.patient_messages m
      join public.patient_conversations c on c.id = m.conversation_id
     where c.id = p_conversation_id and c.channel = 'chat' and c.patient_id = p_member_id
       and public._patient_visible_message(m)
     order by m.created_at;
end;
$$;

-- Who is writing, as staff will see it.
create or replace function public._patient_sender_name(p_member_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when pa.relationship = 'self'
              then coalesce((select a.name from public.all_patients a where a.member_id = p_member_id
                              order by a.updated_at desc nulls last limit 1), 'Patient')
              else coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email) || ' ('
                   || case pa.relationship when 'dependent' then 'parent or guardian' else 'caregiver' end || ')'
         end
    from public.patient_accounts pa
    join auth.users u on u.id = pa.user_id
   where pa.user_id = auth.uid() and pa.member_id = p_member_id;
$$;

-- Sends into an existing conversation of this profile.
create or replace function public.patient_send_message(p_member_id text, p_conversation_id uuid, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if b = '' or length(b) > 4000 then
    raise exception 'A message must be 1 to 4000 characters.' using errcode = '22023';
  end if;
  perform 1 from public.patient_conversations c
   where c.id = p_conversation_id and c.channel = 'chat' and c.patient_id = p_member_id
   for update;
  if not found then
    raise exception 'This conversation is not available.' using errcode = 'P0002';
  end if;

  insert into public.patient_messages (conversation_id, kind, direction, sender_name, body, status, meta)
  values (p_conversation_id, 'message', 'in', public._patient_sender_name(p_member_id), b, 'delivered',
          jsonb_build_object('sent_by_user_id', auth.uid(), 'via', 'patient_app'))
  returning id into v_id;

  update public.patient_conversations
     set last_preview = left(regexp_replace(b, '\s+', ' ', 'g'), 140),
         last_message_at = now(),
         archived = false,
         unread_count = unread_count + 1
   where id = p_conversation_id;
  return v_id;
end;
$$;

-- Starts a conversation, or reuses this profile's chat that already includes
-- the care team member (any chat when none is named), then sends the first
-- message. Returns the conversation id.
create or replace function public.patient_start_conversation(p_member_id text, p_body text, p_care_team_name text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_conv uuid;
  v_name text;
  v_new integer;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;

  select c.id into v_conv
    from public.patient_conversations c
   where c.channel = 'chat' and c.patient_id = p_member_id
     and (p_care_team_name is null
          or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(c.members) = 'array' then c.members else '[]'::jsonb end) mem
                      where mem->>'name' = p_care_team_name))
   order by c.last_message_at desc
   limit 1;

  if v_conv is null then
    select count(*) into v_new from public.patient_conversations c
     where c.patient_id = p_member_id and c.channel = 'chat' and c.created_at > now() - interval '1 day'
       and c.created_by_name = 'Patient app';
    if v_new >= 5 then
      raise exception 'You started several conversations today. Please continue in an existing one.' using errcode = 'P0001';
    end if;
    select a.name into v_name from public.all_patients a
     where a.member_id = p_member_id order by a.updated_at desc nulls last limit 1;
    insert into public.patient_conversations (channel, patient_id, patient_name, group_name, members, created_by_name)
    values ('chat', p_member_id, coalesce(v_name, ''), 'Care for ' || coalesce(v_name, 'patient'),
            case when p_care_team_name is null then '[]'::jsonb
                 else jsonb_build_array(jsonb_build_object('name', p_care_team_name)) end,
            'Patient app')
    returning id into v_conv;
  end if;

  perform public.patient_send_message(p_member_id, v_conv, p_body);
  return v_conv;
end;
$$;

-- Marks the care team's messages in one conversation read.
create or replace function public.patient_mark_conversation_read(p_member_id text, p_conversation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.patient_messages m
     set read_at = now(), status = 'read'
    from public.patient_conversations c
   where c.id = p_conversation_id and c.channel = 'chat' and c.patient_id = p_member_id
     and m.conversation_id = c.id and m.direction = 'out'
     and public._patient_visible_message(m) and m.read_at is null
     and m.status in ('sent', 'delivered');
end;
$$;

revoke execute on function public._patient_visible_message(public.patient_messages) from public, anon, authenticated;
revoke execute on function public._patient_sender_name(text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.patient_care_team(text)',
    'public.patient_conversations(text)',
    'public.patient_conversation_messages(text, uuid)',
    'public.patient_send_message(text, uuid, text)',
    'public.patient_start_conversation(text, text, text)',
    'public.patient_mark_conversation_read(text, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_mark_conversation_read(text, uuid);
--   drop function if exists public.patient_start_conversation(text, text, text);
--   drop function if exists public.patient_send_message(text, uuid, text);
--   drop function if exists public._patient_sender_name(text);
--   drop function if exists public.patient_conversation_messages(text, uuid);
--   drop function if exists public.patient_conversations(text);
--   drop function if exists public._patient_visible_message(public.patient_messages);
--   drop function if exists public.patient_care_team(text);
