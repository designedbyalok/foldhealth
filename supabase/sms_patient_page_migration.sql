-- SMS works like Chat in the prototype: no SMS gateway, so an SMS is saved in
-- the app and the patient reads and answers it on their patient page
-- (/#/p/<token>), the same page Chat uses. This lets the comms_patient_*
-- functions serve SMS threads as well as Chat ones; nothing else changes.
--
-- Same functions as supabase/patient_conversations_migration.sql with
-- channel = 'chat' widened to channel IN ('chat', 'sms'). Idempotent
-- (CREATE OR REPLACE), safe to run more than once. Until it runs, an SMS
-- thread's patient page says the link isn't active; staff-side sending
-- still works.

CREATE OR REPLACE FUNCTION public.comms_patient_thread(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.patient_conversations;
BEGIN
  IF length(coalesce(p_token, '')) < 16 THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.patient_conversations
   WHERE channel IN ('chat', 'sms') AND patient_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', c.id,
      'patient_token', c.patient_token,
      'patient_name', c.patient_name,
      'group_name', c.group_name,
      'last_preview', c.last_preview,
      'members', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', mem->>'name'))
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.members) = 'array' THEN c.members ELSE '[]'::jsonb END) mem
         WHERE mem->>'name' IS NOT NULL), '[]'::jsonb)),
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', m.id, 'kind', m.kind, 'direction', m.direction,
               'sender_name', m.sender_name, 'body', m.body,
               'meta', CASE WHEN m.meta ? 'attachment'
                            THEN jsonb_build_object('attachment', m.meta->'attachment')
                            ELSE '{}'::jsonb END,
               'status', m.status, 'read_at', m.read_at, 'created_at', m.created_at,
               'internal', false)
             ORDER BY m.created_at)
        FROM public.patient_messages m
       WHERE m.conversation_id = c.id AND m.kind = 'message'
         AND NOT m.internal AND m.status <> 'draft'), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.comms_patient_send(p_token text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.patient_conversations;
  m public.patient_messages;
  b text := btrim(coalesce(p_body, ''));
BEGIN
  IF b = '' OR length(b) > 4000 THEN
    RAISE EXCEPTION 'A message must be 1 to 4000 characters.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_token, '')) < 16 THEN
    RAISE EXCEPTION 'This link is no longer active.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO c FROM public.patient_conversations
   WHERE channel IN ('chat', 'sms') AND patient_token = p_token
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This link is no longer active.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.patient_messages (conversation_id, kind, direction, sender_name, body, status)
  VALUES (c.id, 'message', 'in', c.patient_name, b, 'delivered')
  RETURNING * INTO m;

  UPDATE public.patient_conversations
     SET last_preview = left(regexp_replace(b, '\s+', ' ', 'g'), 140),
         last_message_at = m.created_at,
         archived = false,
         unread_count = unread_count + 1
   WHERE id = c.id;

  RETURN jsonb_build_object(
    'id', m.id, 'kind', m.kind, 'direction', m.direction,
    'sender_name', m.sender_name, 'body', m.body, 'meta', '{}'::jsonb,
    'status', m.status, 'read_at', m.read_at, 'created_at', m.created_at,
    'internal', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.comms_patient_mark_read(p_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF length(coalesce(p_token, '')) < 16 THEN RETURN; END IF;
  UPDATE public.patient_messages m
     SET read_at = now(), status = 'read'
    FROM public.patient_conversations c
   WHERE c.channel IN ('chat', 'sms') AND c.patient_token = p_token
     AND m.conversation_id = c.id
     AND m.direction = 'out' AND m.kind = 'message'
     AND NOT m.internal AND m.read_at IS NULL
     AND m.status IN ('sent', 'delivered');
END;
$$;

REVOKE ALL ON FUNCTION public.comms_patient_thread(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comms_patient_send(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comms_patient_mark_read(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comms_patient_thread(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comms_patient_send(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comms_patient_mark_read(text) TO anon, authenticated;
