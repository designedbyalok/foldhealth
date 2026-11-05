-- Member tags (Settings > Member/Leads > Tags, Figma Settings 516:2137) and
-- which tags each patient has (the patient banner's "+" opens Add Tag).
--
-- 1. contact_tags: the practice's tags, seeded by `bun run seed` from
--    src/features/settings/member-leads/tags/contactTags.js.
-- 2. patient_tags: one row per patient + tag.
--
-- Additive and idempotent: safe to run more than once. Until it runs, the UI
-- shows the built-in tags and keeps patient tags in memory.

CREATE TABLE IF NOT EXISTS public.contact_tags (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  color        text NOT NULL,             -- "#RRGGBB", picked by the admin
  sort_order   integer NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on contact_tags" ON public.contact_tags;
CREATE POLICY "Allow all on contact_tags" ON public.contact_tags
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

CREATE TABLE IF NOT EXISTS public.patient_tags (
  patient_id  text NOT NULL,
  tag_id      text NOT NULL REFERENCES public.contact_tags(id) ON DELETE CASCADE,
  added_by    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, tag_id)
);
CREATE INDEX IF NOT EXISTS patient_tags_tag_idx ON public.patient_tags (tag_id);
ALTER TABLE public.patient_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_tags" ON public.patient_tags;
CREATE POLICY "Allow all on patient_tags" ON public.patient_tags
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

NOTIFY pgrst, 'reload schema';
