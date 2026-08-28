-- Care Plan template favorites — a per-user star on a library template.
--
-- THE HOLE THIS CLOSES
-- The Care Plan Library lists every template flat, in created-at order. A user
-- who reaches for the same two or three templates constantly had no way to mark
-- them, so every visit meant re-scanning the whole list (roadmap #3). Favorites
-- are a per-user preference, not a property of the template, so they live in
-- their own join table keyed by (user, template) rather than a column on
-- care_plan_templates that every user would share.
--
-- WHAT THIS DOES
--   care_plan_template_favorites — one row per (user, favorited template).
--   user_id is text to match the id the app already keys other per-user prefs
--   by (auth user id, falling back to the profile id). ON DELETE CASCADE so a
--   deleted template takes its stars with it.
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon`. The
-- rows are per-user by data (user_id), but the app filters by user_id itself;
-- there is no auth.uid() coupling to scope by, consistent with the other
-- per-user preference tables.

CREATE TABLE IF NOT EXISTS public.care_plan_template_favorites (
  user_id     text NOT NULL,
  template_id uuid NOT NULL REFERENCES public.care_plan_templates(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, template_id)
);

CREATE INDEX IF NOT EXISTS care_plan_template_favorites_user_idx
  ON public.care_plan_template_favorites (user_id);

ALTER TABLE public.care_plan_template_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage care_plan_template_favorites" ON public.care_plan_template_favorites;
CREATE POLICY "Staff manage care_plan_template_favorites"
  ON public.care_plan_template_favorites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
