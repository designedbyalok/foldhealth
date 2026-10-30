-- FCS-5677 (SMS for shared phone numbers): bring production in line with
-- the dev database.
--
-- Why one file: PR Autopilot runs the supabase/*.sql files a PR adds or
-- changes. The FCS-5677 migrations below went in with #664 and #681, which
-- were merged by hand, so they may never have run on production. This file
-- gathers them in order so the next PR's Autopilot run applies all of it.
--
-- Safe to run more than once, and on a database where some of it already
-- ran: columns use ADD COLUMN IF NOT EXISTS, functions CREATE OR REPLACE, the
-- trigger is dropped and re-created, patient rows upsert on their id, and
-- phone updates only set a value. Nothing is deleted.
--
-- Review notes (Autopilot runbook, step 3):
-- - No CREATE POLICY and no GRANT. The three patient-page functions are
--   CREATE OR REPLACE'd (still SECURITY DEFINER, same rules, widened from
--   Chat to SMS threads); replacing a function keeps the grants it already
--   has from patient_conversations_migration.sql.
-- - New patient rows: four demo family members with id = member_id and a
--   "sms-family-" prefix no real Fold ID uses (Liam, Ava on Annette's number;
--   Priya, Rohan on Alok's). 11089, 11052, 11103 already exist; only their
--   phone changes.
-- - Tables written: patient_messages, patient_conversations (columns,
--   trigger, phone), all_patients, patients, hedis_members (phone only).
-- - Not included on purpose: the dev-only cleanup of failed test messages,
--   and all_patients_backfill_migration.sql (not part of this ticket).

BEGIN;

-- all_patients.family_id ties a family member to the number's owner. It's in
-- the bootstrap table definition; added here too in case an older
-- production table predates it.
ALTER TABLE public.all_patients ADD COLUMN IF NOT EXISTS family_id text;

-- ========================================================================
-- 1. Who each SMS is logged for (sms_member_attribution_migration.sql)
-- ========================================================================

-- SMS attribution for shared phone numbers (FCS-5677).
--
-- When several members share one phone number, staff pick which member an
-- SMS is logged for. The pick is stored on the message; a message without it
-- belongs to its conversation's patient (patient_conversations.patient_id).
-- The member's CRM Activity lists the SMS logged for them.
--
-- logged_for_patient_id: all_patients.id of the member.
-- logged_for_name:       their name at the time, for display without a join.
--
-- Safe to run more than once.

ALTER TABLE public.patient_messages ADD COLUMN IF NOT EXISTS logged_for_patient_id text;
ALTER TABLE public.patient_messages ADD COLUMN IF NOT EXISTS logged_for_name text;

CREATE INDEX IF NOT EXISTS patient_messages_logged_for_idx
  ON public.patient_messages (logged_for_patient_id)
  WHERE logged_for_patient_id IS NOT NULL;

-- PostgREST caches the schema: reload so the app sees the new columns now.

-- ========================================================================
-- 2. Custom thread names (sms_thread_name_migration.sql)
-- ========================================================================

-- FCS-5677: a custom name for a shared-number SMS thread (e.g. "Garcia
-- Family"). It replaces the members' names ("Annette, Liam, Ava") in the thread header and the Messages
-- list, survives a change of owner, is searchable, and is internal only
-- (never sent to the family). NULL shows the names.
--
-- Additive and idempotent: safe to run more than once. The app works before
-- it runs (names are kept in the browser until then).

ALTER TABLE public.patient_conversations
  ADD COLUMN IF NOT EXISTS thread_name text;

-- ========================================================================
-- 3. Auto-assign sessions and their trigger (sms_session_migration.sql)
-- ========================================================================

-- FCS-5677: a shared number's auto-assign session. When staff log a
-- received SMS for a member with "…to be received today", later incoming
-- messages go to that member until 11:59 PM; with "…all incoming messages
-- after it", until someone logs an incoming message by hand. Either can be
-- stopped or switched.
--   sms_session: { member_id, member_name, started_at, until, ends }
--   until NULL (ends = 'manual') means no end time.  (sms_session NULL = none)
--
-- The trigger assigns each new reply as it's saved, so it works whether or
-- not anyone has the thread open. It only fills in a reply that names no
-- one, and marks it meta.assigned_by = 'session' (a staff assignment is
-- 'staff'), which "all incoming messages after it" relies on.
--
-- Additive and idempotent: safe to run more than once. Needs the columns
-- from sms_member_attribution_migration.sql, so it adds them too (IF NOT
-- EXISTS). The app works before it runs (the session is kept in the browser
-- and applied while the thread is open).

ALTER TABLE public.patient_conversations
  ADD COLUMN IF NOT EXISTS sms_session jsonb;

ALTER TABLE public.patient_messages ADD COLUMN IF NOT EXISTS logged_for_patient_id text;
ALTER TABLE public.patient_messages ADD COLUMN IF NOT EXISTS logged_for_name text;

CREATE OR REPLACE FUNCTION public.comms_sms_session_assign()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s jsonb;
BEGIN
  IF NEW.direction <> 'in' OR NEW.kind <> 'message' OR NEW.internal
     OR NEW.logged_for_patient_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT c.sms_session INTO s
    FROM public.patient_conversations c
   WHERE c.id = NEW.conversation_id AND c.channel = 'sms';
  IF s IS NULL OR s->>'member_id' IS NULL
     OR (s->>'until' IS NOT NULL AND (s->>'until')::timestamptz <= now())
     OR coalesce(NEW.created_at, now()) < (s->>'started_at')::timestamptz THEN
    RETURN NEW;
  END IF;
  NEW.logged_for_patient_id := s->>'member_id';
  NEW.logged_for_name := s->>'member_name';
  NEW.meta := coalesce(NEW.meta, '{}'::jsonb) || jsonb_build_object('assigned_by', 'session');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comms_sms_session_assign ON public.patient_messages;
CREATE TRIGGER comms_sms_session_assign
  BEFORE INSERT ON public.patient_messages
  FOR EACH ROW EXECUTE FUNCTION public.comms_sms_session_assign();

-- ========================================================================
-- 4. The patient page opens SMS threads (sms_patient_page_migration.sql)
-- ========================================================================

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


-- ========================================================================
-- 5. Annette's shared number and her family (annette_shared_number_migration.sql)
-- ========================================================================

-- Annette Brave (11089), the team's test patient, moves to +91 91753 67487,
-- a real number we own, and shares it with two demo family members, Liam
-- Johnson and Ava Carter (FCS-5677: SMS for a shared phone number). Same as
-- the dev database. Safe to run more than once.
-- Review note: 11089 already exists in all_patients, patients and
-- hedis_members; this only changes its phone. The two family rows are new,
-- with id = member_id and a prefix no real Fold ID uses.

-- Annette's number everywhere a patient phone lives.
UPDATE public.all_patients  SET phone = '+919175367487' WHERE id = '11089';
UPDATE public.patients      SET phone = '+919175367487' WHERE id = '11089';
UPDATE public.hedis_members SET phone = '+919175367487' WHERE lower(trim(name)) = 'annette brave';

-- Her son and daughter on the same number. Ids are prefixed so they can
-- never overwrite a real patient.
INSERT INTO public.all_patients (id, member_id, source, name, initials, gender, age, language, phone, family_id)
VALUES
  ('sms-family-11089-liam', 'sms-family-11089-liam', 'manual', 'Liam Johnson', 'LJ', 'M', 34, 'en', '+919175367487', '11089'),
  ('sms-family-11089-ava',  'sms-family-11089-ava', 'manual', 'Ava Carter',   'AC', 'F', 31, 'en', '+919175367487', '11089')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, family_id = EXCLUDED.family_id, member_id = EXCLUDED.member_id;

-- Comms threads already opened with Annette follow her new number.
DO $$
BEGIN
  IF to_regclass('public.patient_conversations') IS NOT NULL THEN
    UPDATE public.patient_conversations
       SET patient_phone = '+919175367487'
     WHERE patient_id = '11089'
       AND patient_phone IS DISTINCT FROM '+919175367487';
  END IF;
END $$;

-- ========================================================================
-- 6. Alok's test number and his family (alok_test_patient_migration.sql)
-- ========================================================================

-- Alok Kumar (11052) becomes a second real-number test patient, +91 78703
-- 87321, a number the team owns, so SMS from Messages reaches him. Two demo
-- family members share his number (FCS-5677: SMS for a shared phone number).
-- Safe to run more than once, on dev and on production.
-- Review note: 11052 already exists in patients (same person, id =
-- member_id); this adds the matching all_patients row Comms reads and sets
-- the phone. The two family rows are new, with id = member_id and a prefix no
-- real Fold ID uses.

-- TOC patient record.
UPDATE public.patients SET phone = '+917870387321' WHERE id = '11052';

-- Comms picks patients from all_patients.
INSERT INTO public.all_patients (id, source, member_id, name, initials, gender, age, language, email, phone, state)
VALUES ('11052', 'manual', '11052', 'Alok Kumar', 'AK', 'M', 28, 'en', 'alok.kumar@email.com', '+917870387321', 'CA')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone;

-- His family on the same number. Prefixed ids never collide with a real patient.
INSERT INTO public.all_patients (id, member_id, source, name, initials, gender, age, language, phone, family_id)
VALUES
  ('sms-family-11052-priya', 'sms-family-11052-priya', 'manual', 'Priya Kumar', 'PK', 'F', 27, 'en', '+917870387321', '11052'),
  ('sms-family-11052-rohan', 'sms-family-11052-rohan', 'manual', 'Rohan Kumar', 'RK', 'M', 6,  'en', '+917870387321', '11052')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, family_id = EXCLUDED.family_id, member_id = EXCLUDED.member_id;

-- Any Comms thread already opened with him follows the number.
DO $$
BEGIN
  IF to_regclass('public.patient_conversations') IS NOT NULL THEN
    UPDATE public.patient_conversations
       SET patient_phone = '+917870387321'
     WHERE patient_id = '11052'
       AND patient_phone IS DISTINCT FROM '+917870387321';
  END IF;
END $$;

-- ========================================================================
-- 7. Amy's test number (amy_test_number_migration.sql)
-- ========================================================================

-- Amy Phillips (11103) becomes a real-number test patient, +91 97185 13584,
-- a number the team owns, so SMS from Messages reaches her. Same as the dev
-- database. Safe to run more than once.
-- Review note: 11103 already exists in all_patients; this only changes its
-- phone. No rows are inserted or deleted.

UPDATE public.all_patients  SET phone = '+919718513584' WHERE id = '11103';
UPDATE public.patients      SET phone = '+919718513584' WHERE id = '11103';

DO $$
BEGIN
  IF to_regclass('public.patient_conversations') IS NOT NULL THEN
    UPDATE public.patient_conversations
       SET patient_phone = '+919718513584'
     WHERE patient_id = '11103'
       AND patient_phone IS DISTINCT FROM '+919718513584';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
