-- How long the care plan review call ran, in seconds, from the Review care
-- plan drawer's timer. Written on Save call note and Complete Review; a
-- review picked up again later adds to it. Shown beside the call note.
ALTER TABLE public.care_plan_call_reviews
  ADD COLUMN IF NOT EXISTS duration_seconds integer;
