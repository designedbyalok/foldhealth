-- Out of Office auto-replies go out once per conversation for each Out of
-- Office record. With several staff browsers open, two could try at once;
-- this index keeps only the first (the app treats the duplicate as already
-- sent). Messages marked ooo_auto_reply without a record id (demo data) are
-- not limited.
-- Run on dev, then prod. Safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS patient_messages_one_ooo_auto_reply
  ON public.patient_messages (conversation_id, (meta->>'ooo_record_id'))
  WHERE meta->>'ooo_auto_reply' = 'true' AND meta->>'ooo_record_id' IS NOT NULL;
