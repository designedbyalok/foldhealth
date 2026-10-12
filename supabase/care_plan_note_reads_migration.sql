-- When each user last looked at a care plan item's notes. A goal,
-- intervention or barrier whose latest note (by someone else) is newer than
-- this shows its note count as new on the care plan tables.

CREATE TABLE IF NOT EXISTS public.care_plan_note_reads (
  user_id     uuid NOT NULL DEFAULT auth.uid(),
  entity_type text NOT NULL CHECK (entity_type IN ('goal', 'intervention', 'barrier')),
  entity_id   text NOT NULL,
  seen_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id)
);

ALTER TABLE public.care_plan_note_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own care_plan_note_reads" ON public.care_plan_note_reads;
CREATE POLICY "Own care_plan_note_reads" ON public.care_plan_note_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
