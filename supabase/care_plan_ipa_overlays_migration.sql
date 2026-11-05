-- Per-IPA configuration overlays on care plan templates.
--   ipas: the account's IPA registry. A patient's recorded IPA value maps to an
--     IPA by name or alias, which absorbs inconsistent spellings.
--   care_plan_template_overlays: one per template and IPA. `overrides` hides,
--     reprioritizes, re-cadences and rewords template items for patients, adds
--     local items, and sets who must sign (see lib/ipaOverlays.js).
--   A template run on a plan records the overlay it was applied with and its
--     sign-off route; plan items carry their patient-facing wording.

CREATE TABLE IF NOT EXISTS public.ipas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  aliases     text[] NOT NULL DEFAULT '{}',
  active      boolean NOT NULL DEFAULT true,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ipas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in staff on ipas" ON public.ipas;
CREATE POLICY "Signed-in staff on ipas" ON public.ipas
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

CREATE TABLE IF NOT EXISTS public.care_plan_template_overlays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES public.care_plan_templates(id) ON DELETE CASCADE,
  ipa_id       uuid NOT NULL REFERENCES public.ipas(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  overrides    jsonb NOT NULL DEFAULT '{}'::jsonb,
  cloned_from  uuid REFERENCES public.care_plan_template_overlays(id) ON DELETE SET NULL,
  created_by   text,
  updated_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, ipa_id)
);
ALTER TABLE public.care_plan_template_overlays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in staff on care_plan_template_overlays" ON public.care_plan_template_overlays;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Signed-in staff on care_plan_template_overlays" ON public.care_plan_template_overlays
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

ALTER TABLE public.patient_care_plan_template_instances
  ADD COLUMN IF NOT EXISTS overlay_id    uuid REFERENCES public.care_plan_template_overlays(id) ON DELETE SET NULL,
  -- { mode, roles, people, ipaName } copied at apply time, so editing the
  -- overlay later doesn't change who must sign plans already built from it.
  ADD COLUMN IF NOT EXISTS signoff_route jsonb;

ALTER TABLE public.patient_care_plan_goals         ADD COLUMN IF NOT EXISTS patient_title text;
ALTER TABLE public.patient_care_plan_interventions ADD COLUMN IF NOT EXISTS patient_title text;
ALTER TABLE public.patient_care_plan_barriers      ADD COLUMN IF NOT EXISTS patient_title text;

-- ── Seed: the IPA values already on patient records ───────────────────────
INSERT INTO public.ipas (name, aliases, created_by) VALUES
  ('Astrana', ARRAY['Astrana IPA', 'Astrana Health'], 'Fold Health'),
  ('CFC', ARRAY[]::text[], 'Fold Health'),
  ('ACP', ARRAY[]::text[], 'Fold Health'),
  ('LA Care', ARRAY['L.A. Care', 'LA Care Health Plan'], 'Fold Health'),
  ('IPA-North', ARRAY[]::text[], 'Fold Health'),
  ('IPA-West', ARRAY[]::text[], 'Fold Health'),
  ('IPA-1', ARRAY[]::text[], 'Fold Health'),
  ('IPA-2', ARRAY[]::text[], 'Fold Health'),
  ('IPA-3', ARRAY[]::text[], 'Fold Health')
ON CONFLICT (name) DO NOTHING;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.patient_care_plan_goals drop column if exists patient_title;
--   alter table public.patient_care_plan_interventions drop column if exists patient_title;
--   alter table public.patient_care_plan_barriers drop column if exists patient_title;
--   alter table public.patient_care_plan_template_instances drop column if exists overlay_id, drop column if exists signoff_route;
--   drop table if exists public.care_plan_template_overlays;
--   drop table if exists public.ipas;
