-- Saved print settings for a care plan's Preview & Share (Personalize tab):
-- group by, care plan note, patient demographics, header, footer and logo.
--
--   org   shared with everyone; one org preset can be the default every
--         Preview & Share opens with
--   user  private to its creator (owner_user_id)

CREATE TABLE IF NOT EXISTS public.care_plan_print_presets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  scope         text NOT NULL DEFAULT 'org' CHECK (scope IN ('org', 'user')),
  owner_user_id uuid,
  is_default    boolean NOT NULL DEFAULT false,
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    text,
  updated_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_plan_print_presets_owner_check CHECK (scope <> 'user' OR owner_user_id IS NOT NULL),
  CONSTRAINT care_plan_print_presets_default_check CHECK (NOT is_default OR scope = 'org')
);

-- At most one organization default.
CREATE UNIQUE INDEX IF NOT EXISTS care_plan_print_presets_one_default
  ON public.care_plan_print_presets ((true)) WHERE is_default;

ALTER TABLE public.care_plan_print_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read care_plan_print_presets" ON public.care_plan_print_presets;
DROP POLICY IF EXISTS "Staff write care_plan_print_presets" ON public.care_plan_print_presets;

CREATE POLICY "Staff read care_plan_print_presets" ON public.care_plan_print_presets
  FOR SELECT TO authenticated
  USING (scope <> 'user' OR owner_user_id = auth.uid());

CREATE POLICY "Staff write care_plan_print_presets" ON public.care_plan_print_presets
  FOR ALL TO authenticated
  USING (scope <> 'user' OR owner_user_id = auth.uid())
  WITH CHECK (scope <> 'user' OR owner_user_id = auth.uid());
