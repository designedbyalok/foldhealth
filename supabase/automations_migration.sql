-- Automations (Settings > Automations): the automation builder, templates,
-- runs, analytics and history. Replaces Settings > Automation Rules: each
-- automation_rules row is copied into automations as an automation with the
-- "A patient is enrolled in a care program" trigger, a clinical criteria
-- condition and an "Attach care plan templates" action, so enrollment
-- auto-apply keeps working (store: runAutoApplyRules). automation_rules and
-- automation_rule_runs are left in place, untouched.
--
-- Nothing is delivered from these tables: a run is simulated in the app
-- (src/features/automations/lib/simulate.js) and its per-member path and
-- message outcomes are stored here for History, Analytics and the member
-- trace.
--
-- Additive and idempotent. RLS: signed-in staff only. Seed with `bun run seed`.

CREATE TABLE IF NOT EXISTS public.automation_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  -- careCompliance | careDelivery | feedback | outreach
  category      text NOT NULL,
  recommended   boolean NOT NULL DEFAULT false,
  -- { nodes: [{ id, type, parentId, branch, order, config }] }, see lib/graph.js
  graph         jsonb NOT NULL DEFAULT '{"nodes":[]}'::jsonb,
  schedule      text NOT NULL DEFAULT 'onTrigger',
  used_count    integer NOT NULL DEFAULT 0,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  description           text NOT NULL DEFAULT '',
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  -- onTrigger | daily | weekly | monthly | manual (manual = execution type Manual)
  schedule              text NOT NULL DEFAULT 'onTrigger',
  run_time              text,
  population_group_id   text,
  population_group_name text,
  -- The published graph runs; the builder edits draft_graph (autosaved every
  -- 10 minutes) until Save copies it over and clears it.
  graph                 jsonb NOT NULL DEFAULT '{"nodes":[]}'::jsonb,
  draft_graph           jsonb,
  template_id           uuid REFERENCES public.automation_templates(id) ON DELETE SET NULL,
  legacy_rule_id        uuid,
  last_executed_at      timestamptz,
  last_run_status       text,
  last_tested_at        timestamptz,
  created_by            text,
  updated_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS automations_legacy_rule_idx ON public.automations (legacy_rule_id) WHERE legacy_rule_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id      uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  -- event | scheduled | manual | retry | retrigger
  kind               text NOT NULL DEFAULT 'event',
  -- member | patientGroup | leadGroup | employer | trigger
  target_type        text,
  target_label       text,
  member_count       integer NOT NULL DEFAULT 0,
  completed_count    integer NOT NULL DEFAULT 0,
  in_progress_count  integer NOT NULL DEFAULT 0,
  failed_count       integer NOT NULL DEFAULT 0,
  minutes_saved      integer NOT NULL DEFAULT 0,
  -- The graph as it ran, so a trace still lines up after later edits.
  graph              jsonb,
  triggered_by       text,
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz
);
CREATE INDEX IF NOT EXISTS automation_runs_automation_idx ON public.automation_runs (automation_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_run_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  automation_id  uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  patient_id     text NOT NULL,
  patient_name   text,
  status         text NOT NULL CHECK (status IN ('completed', 'in_progress', 'failed')),
  failing_reason text,
  minutes_saved  integer NOT NULL DEFAULT 0,
  -- { [nodeId]: { status, outcome, at, error } }
  path           jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz
);
CREATE INDEX IF NOT EXISTS automation_run_members_automation_idx ON public.automation_run_members (automation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS automation_run_members_run_idx ON public.automation_run_members (run_id);
CREATE INDEX IF NOT EXISTS automation_run_members_patient_idx ON public.automation_run_members (patient_id);

CREATE TABLE IF NOT EXISTS public.automation_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_member_id   uuid NOT NULL REFERENCES public.automation_run_members(id) ON DELETE CASCADE,
  run_id          uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  automation_id   uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  node_id         text NOT NULL,
  channel         text NOT NULL CHECK (channel IN ('email', 'sms')),
  patient_id      text NOT NULL,
  patient_name    text,
  address         text,
  status          text NOT NULL CHECK (status IN ('delivered', 'opened', 'clicked', 'failed')),
  opens           integer NOT NULL DEFAULT 0,
  clicks          integer NOT NULL DEFAULT 0,
  failing_reason  text,
  sent_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_messages_automation_idx ON public.automation_messages (automation_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_edit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  actor          text,
  summary        text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_edit_log_automation_idx ON public.automation_edit_log (automation_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['automation_templates', 'automations', 'automation_runs', 'automation_run_members', 'automation_messages', 'automation_edit_log']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Staff manage %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Staff manage %s" ON public.%I FOR ALL TO authenticated USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null)', t, t);
  END LOOP;
END $$;

-- Carry Settings > Automation Rules over as automations (once per rule).
-- trigger → clinical criteria → attach care plan templates. Skipped when the
-- automation rules migration never ran.
DO $$
BEGIN
  IF to_regclass('public.automation_rules') IS NULL THEN RETURN; END IF;
  EXECUTE $sql$
INSERT INTO public.automations (name, description, status, schedule, graph, legacy_rule_id, created_by, updated_by, created_at, updated_at)
SELECT
  r.name,
  r.description,
  CASE WHEN r.enabled THEN 'active' ELSE 'inactive' END,
  'onTrigger',
  jsonb_build_object('nodes', jsonb_build_array(
    jsonb_build_object('id', 'trigger', 'type', 'careProgramEnrolled', 'parentId', null, 'branch', null, 'order', 0,
      'config', jsonb_build_object('programCodes', to_jsonb(r.program_codes))),
    jsonb_build_object('id', 'criteria', 'type', 'clinicalCriteria', 'parentId', 'trigger', 'branch', 'next', 'order', 0,
      'config', jsonb_build_object('match', r.match, 'criteria', r.conditions)),
    jsonb_build_object('id', 'attach', 'type', 'attachCarePlan', 'parentId', 'criteria', 'branch', 'next', 'order', 0,
      'config', jsonb_build_object('templateIds', to_jsonb(r.template_ids), 'reviewer', r.reviewer))
  )),
  r.id,
  r.created_by,
  r.updated_by,
  r.created_at,
  r.updated_at
FROM public.automation_rules r
ON CONFLICT (legacy_rule_id) WHERE legacy_rule_id IS NOT NULL DO NOTHING
  $sql$;
END $$;
