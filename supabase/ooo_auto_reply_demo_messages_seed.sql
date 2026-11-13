-- Demo: Out of Office auto-replies in Comms (meta.ooo_auto_reply), so the
-- magenta auto-reply card shows in a Chat, an SMS and an Email thread:
--   - Chat, Amy Phillips: the auto-reply after her "Hi Doctor".
--   - SMS, Brave Family Care shared number: Annette asks to move her
--     appointment, then the auto-reply.
--   - Email, Annette Brave: her question about the forms, then the auto-reply.
-- Sent for Devanshi Sharma. Fixed ids, and only into conversations that
-- exist. Run on dev, then prod. Safe to re-run.

INSERT INTO public.patient_messages
  (id, conversation_id, kind, direction, internal, sender_name, body, status, from_addr, to_addr, subject, meta, created_at)
SELECT v.id::uuid, v.conversation_id::uuid, v.kind, v.direction, false, v.sender_name, v.body, v.status,
       v.from_addr, v.to_addr, v.subject, v.meta::jsonb, v.created_at::timestamptz
FROM (VALUES
  ('497f8058-662a-49cb-bdea-10f1dbdfb485', 'd2ae5817-eb10-45ea-a31a-6a9a73c4f688', 'message', 'out', 'Devanshi Sharma',
   'Hi! Thanks for reaching out. I''m currently unavailable but will get back to you as soon as I can.', 'read',
   NULL, NULL, NULL, '{"ooo_auto_reply": true}', '2026-11-13T08:50:00Z'),
  ('88ddbd3a-6916-413f-9911-6167153c99a0', 'faecd951-a90b-4093-aa27-15e20957d168', 'message', 'in', 'Annette Brave',
   'Hi, can I move my appointment to next week?', 'sent',
   NULL, NULL, NULL, '{}', '2026-11-13T08:50:00Z'),
  ('85fe31dd-6878-45bd-8102-8cef963af84b', 'faecd951-a90b-4093-aa27-15e20957d168', 'message', 'out', 'Devanshi Sharma',
   'Hi! Thanks for reaching out. I''m currently unavailable but will get back to you as soon as I can.', 'delivered',
   NULL, '+919175367487', NULL, '{"ooo_auto_reply": true}', '2026-11-13T08:50:02Z'),
  ('a9800641-2ad5-461b-810d-3c986f89f107', 'fa4efba3-533b-4296-9b6e-5045663c972a', 'email', 'in', 'Annette Brave',
   'Hello, I have a question about the forms you sent.', 'sent',
   'annette.brave@email.com', 'care@foldhealth.org', 'Question about my forms', '{}', '2026-11-13T08:50:00Z'),
  ('ea5f9dd5-9c9e-4cff-a0d3-5030213c655e', 'fa4efba3-533b-4296-9b6e-5045663c972a', 'email', 'out', 'Devanshi Sharma',
   'Hi! Thanks for reaching out. I''m currently unavailable but will get back to you as soon as I can.', 'sent',
   'noreply@foldhealth.org', 'annette.brave@email.com', 'Re: Question about my forms', '{"ooo_auto_reply": true}', '2026-11-13T08:50:02Z')
) AS v(id, conversation_id, kind, direction, sender_name, body, status, from_addr, to_addr, subject, meta, created_at)
WHERE EXISTS (SELECT 1 FROM public.patient_conversations c WHERE c.id = v.conversation_id::uuid)
ON CONFLICT (id) DO NOTHING;
