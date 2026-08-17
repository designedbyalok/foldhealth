-- Activity log for population groups — one row per change (created, rule
-- updated, details edited, deleted). Read by the History drawer on the
-- dynamic group detail screen; written fire-and-forget by the store's
-- create/update/delete actions.
--
-- group_id has no FK on purpose: activity is an audit trail, so rows must
-- survive their group's deletion.

CREATE TABLE IF NOT EXISTS public.pop_group_activity (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL,
  action     text NOT NULL,            -- create | override (rule/details updated) | delete
  title      text NOT NULL,            -- headline shown in the log
  detail     text,                     -- optional supporting line
  actor      text,                     -- display name of who did it
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pop_group_activity_group
  ON public.pop_group_activity (group_id, created_at DESC);

ALTER TABLE public.pop_group_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for pop_group_activity" ON public.pop_group_activity;
CREATE POLICY "Allow all for pop_group_activity"
  ON public.pop_group_activity
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
