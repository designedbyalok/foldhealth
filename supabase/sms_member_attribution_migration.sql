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
NOTIFY pgrst, 'reload schema';
