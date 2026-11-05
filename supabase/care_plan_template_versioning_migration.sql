-- Care plan template versioning. Each template is a chain of immutable
-- versions with effective dates; the template row keeps the content of the
-- version in effect (current_version_number), so everything that reads
-- templates keeps working. Each template run on a plan records the version
-- it was applied at, and a pending version it will move to (publish with
-- "migrate all / a cohort" = 'auto', "next review only" = 'review').

CREATE TABLE IF NOT EXISTS public.care_plan_template_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES public.care_plan_templates(id) ON DELETE CASCADE,
  version_number  integer NOT NULL CHECK (version_number > 0),
  effective_date  date NOT NULL,
  -- { name, conditions, goals, interventions, barriers, renewal } as published.
  content         jsonb NOT NULL,
  note            text,
  -- How plans move to it: { mode: all | cohort | review, cohort, targeted }.
  migration       jsonb,
  published_by    text,
  published_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);
CREATE INDEX IF NOT EXISTS care_plan_template_versions_template_idx ON public.care_plan_template_versions (template_id, version_number DESC);
ALTER TABLE public.care_plan_template_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in staff on care_plan_template_versions" ON public.care_plan_template_versions;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Signed-in staff on care_plan_template_versions" ON public.care_plan_template_versions
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS current_version_number integer;

ALTER TABLE public.patient_care_plan_template_instances
  ADD COLUMN IF NOT EXISTS template_version_id     uuid REFERENCES public.care_plan_template_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_version_number integer,
  ADD COLUMN IF NOT EXISTS pending_version_id      uuid REFERENCES public.care_plan_template_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_mode            text CHECK (pending_mode IS NULL OR pending_mode IN ('auto', 'review')),
  ADD COLUMN IF NOT EXISTS pending_effective_date  date;

-- ── Backfill ──────────────────────────────────────────────────────────────
-- Every published template's current content becomes version 1, effective
-- the day it was created; runs already on plans are on version 1.
INSERT INTO public.care_plan_template_versions (template_id, version_number, effective_date, content, note, published_by, published_at)
SELECT t.id, 1, COALESCE(t.created_at::date, current_date),
       jsonb_build_object('name', t.name, 'conditions', to_jsonb(COALESCE(t.conditions, '{}')), 'goals', COALESCE(t.goals, '[]'::jsonb),
                          'interventions', COALESCE(t.interventions, '[]'::jsonb), 'barriers', COALESCE(t.barriers, '[]'::jsonb), 'renewal', t.renewal),
       'Initial version', t.created_by, COALESCE(t.created_at, now())
  FROM public.care_plan_templates t
 WHERE COALESCE(t.status, 'published') <> 'draft'
ON CONFLICT (template_id, version_number) DO NOTHING;

UPDATE public.care_plan_templates t SET current_version_number = 1
 WHERE current_version_number IS NULL AND COALESCE(t.status, 'published') <> 'draft';

UPDATE public.patient_care_plan_template_instances i
   SET template_version_id = v.id, template_version_number = 1
  FROM public.care_plan_template_versions v
 WHERE v.template_id = i.template_id AND v.version_number = 1 AND i.template_version_id IS NULL;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.patient_care_plan_template_instances drop column if exists template_version_id,
--     drop column if exists template_version_number, drop column if exists pending_version_id,
--     drop column if exists pending_mode, drop column if exists pending_effective_date;
--   alter table public.care_plan_templates drop column if exists current_version_number;
--   drop table if exists public.care_plan_template_versions;
