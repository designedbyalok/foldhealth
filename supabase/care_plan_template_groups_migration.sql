-- Care plan template groups: a named bundle of templates a care manager
-- applies to a plan in one click (e.g. "Diabetes with HTN order-set" =
-- Diabetes + Hypertension + SDOH templates). Supervisors manage them in
-- Care Plan Library > Template Groups (lib/templateGroups.js).
--
--   care_plan_template_groups          the group as it is now: name,
--                                      description, members in order and
--                                      its current version.
--   care_plan_template_group_versions  each version's members. A change to
--                                      the members is a new version; a new
--                                      name or description is not.
--   patient_care_plans.applied_template_groups
--     [{ groupId, versionNumber, appliedAt, appliedBy, dismissedVersion }]
--     which group (and version) a plan used, so a plan on an older version
--     can be offered what the group has gained since.
--
-- Groups are versioned on their own: a member template keeps its own
-- versions (care_plan_template_versions).
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.care_plan_template_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  template_ids    uuid[] NOT NULL DEFAULT '{}',
  version_number  integer NOT NULL DEFAULT 1,
  created_by      text,
  updated_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_plan_template_group_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES public.care_plan_template_groups(id) ON DELETE CASCADE,
  version_number  integer NOT NULL,
  template_ids    uuid[] NOT NULL DEFAULT '{}',
  published_by    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, version_number)
);

ALTER TABLE public.patient_care_plans
  ADD COLUMN IF NOT EXISTS applied_template_groups jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.care_plan_template_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_template_group_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template groups for staff" ON public.care_plan_template_groups;
CREATE POLICY "template groups for staff" ON public.care_plan_template_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "template group versions for staff" ON public.care_plan_template_group_versions;
CREATE POLICY "template group versions for staff" ON public.care_plan_template_group_versions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.patient_care_plans DROP COLUMN IF EXISTS applied_template_groups;
-- DROP TABLE IF EXISTS public.care_plan_template_group_versions;
-- DROP TABLE IF EXISTS public.care_plan_template_groups;
