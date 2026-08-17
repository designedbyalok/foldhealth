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

-- RLS: append-only. This is an audit trail, so the policy set is deliberately
-- stricter than the other tables' — there is NO update and NO delete policy, and
-- with RLS enabled that means both verbs are denied outright for `authenticated`.
-- A history anyone can rewrite or erase is not a history. It also matches what
-- the code actually does: the store only ever inserts (logPopGroupActivity) and
-- selects (fetchPopGroupActivity).
--
-- The previous policy was `FOR ALL USING (true) WITH CHECK (true)`, which let any
-- signed-in session edit or delete entries, including an `Invited` account that
-- had never been activated.
--
-- service_role still bypasses RLS entirely, so genuine back-office correction or
-- retention pruning remains possible server-side.
DROP POLICY IF EXISTS "Allow all for pop_group_activity" ON public.pop_group_activity;

-- Reads: any signed-in staff member, matching how the History drawer is used.
DROP POLICY IF EXISTS pop_group_activity_select ON public.pop_group_activity;
CREATE POLICY pop_group_activity_select
  ON public.pop_group_activity FOR SELECT TO authenticated
  USING (true);

-- Appends: the caller must correspond to an active row in `profiles`, the same
-- trusted-membership test the other narrowed tables use.
DROP POLICY IF EXISTS pop_group_activity_insert ON public.pop_group_activity;
CREATE POLICY pop_group_activity_insert
  ON public.pop_group_activity FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

-- Intentionally no UPDATE or DELETE policy. Do not add one without deciding
-- what an editable audit log is for.
