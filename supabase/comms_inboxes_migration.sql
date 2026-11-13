-- Comms inboxes (Settings > Messages > Inboxes): the practice's SMS numbers
-- and email inboxes. Collaborators are the inbox's assignees: its
-- conversations are their work (the Comms "Covering for" filter goes by it).
-- A conversation keeps the inbox it came in on (inbox_id), for the Comms
-- Filters drawer's By Inbox. eFax lines stay in efax_numbers.
-- Run on dev, then prod. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.comms_inboxes (
  id                text PRIMARY KEY,
  channel           text NOT NULL CHECK (channel IN ('sms', 'email')),
  name              text NOT NULL,
  address           text NOT NULL,          -- phone number or email address
  collaborator_ids  text[] NOT NULL DEFAULT '{}',
  created_by        text,
  updated_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comms_inboxes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Allow all" ON public.comms_inboxes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.patient_conversations ADD COLUMN IF NOT EXISTS inbox_id text;

-- Seed: the sample inboxes (same ids as the app's fallback,
-- src/features/settings/messages/inboxes/inboxesMock.js). Collaborators by
-- name, so the ids match each environment's profiles.
WITH people AS (
  SELECT
    (SELECT id::text FROM public.profiles WHERE full_name ILIKE 'navin%jethwani%' LIMIT 1)   AS navin,
    (SELECT id::text FROM public.profiles WHERE full_name ILIKE 'abhijit%gupta%' LIMIT 1)    AS abhijit,
    (SELECT id::text FROM public.profiles WHERE email = 'devanshis@fold.health' LIMIT 1)     AS devanshi
)
INSERT INTO public.comms_inboxes (id, channel, name, address, collaborator_ids)
SELECT v.id, v.channel, v.name, v.address, array_remove(v.collab, NULL)
FROM people, LATERAL (VALUES
  ('inbox-sms-main',       'sms',   'Main Line',       '+1 (775) 555-0100',        ARRAY[people.navin, people.devanshi]),
  ('inbox-sms-care',       'sms',   'Care Management', '+1 (775) 555-0142',        ARRAY[people.abhijit]),
  ('inbox-email-care',     'email', 'Care Team',       'care@foldhealth.org',      ARRAY[people.navin]),
  ('inbox-email-referral', 'email', 'Referrals',       'referrals@foldhealth.org', ARRAY[people.abhijit, people.devanshi])
) AS v(id, channel, name, address, collab)
ON CONFLICT (id) DO NOTHING;

-- Tag the demo threads with an inbox (only ones not tagged yet).
UPDATE public.patient_conversations c SET inbox_id = v.inbox_id
FROM (VALUES
  ('faecd951-a90b-4093-aa27-15e20957d168', 'inbox-sms-main'),   -- Brave Family Care SMS
  ('204781e4-4476-445a-aa72-b26effd6e888', 'inbox-sms-care'),   -- Alok, Priya, +1
  ('10983bf7-aecf-4889-9f18-6c669921fba9', 'inbox-sms-main'),   -- Amy Phillips SMS
  ('fa4efba3-533b-4296-9b6e-5045663c972a', 'inbox-email-care')  -- Annette Brave email
) AS v(id, inbox_id)
WHERE c.id = v.id::uuid AND c.inbox_id IS NULL;

-- Everything else takes its channel's first inbox.
UPDATE public.patient_conversations SET inbox_id = 'inbox-sms-main' WHERE channel = 'sms' AND inbox_id IS NULL;
UPDATE public.patient_conversations SET inbox_id = 'inbox-email-care' WHERE channel = 'email' AND inbox_id IS NULL;
