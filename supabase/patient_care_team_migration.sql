-- A patient's Primary Care Team (Figma SNP Story 3104:1470194), in its own
-- table so any patient can have one, profile or not. One row per member and
-- role; taking someone off the team keeps them as 'historical' with when.
--
-- Replaces p360_profiles.care_team: existing teams are copied across, and
-- patient_care_team() (the patient app's read) now reads this table. The old
-- column is left in place, unused.
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS public.patient_care_team (
  id          text PRIMARY KEY,
  patient_id  text NOT NULL,
  user_id     text,
  name        text NOT NULL,
  initials    text,
  role        text,
  title       text,
  status      text NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'historical')),
  sort_order  integer NOT NULL DEFAULT 0,
  added_by    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);
CREATE INDEX IF NOT EXISTS patient_care_team_patient_idx ON public.patient_care_team (patient_id, status);

ALTER TABLE public.patient_care_team ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_care_team" ON public.patient_care_team;
CREATE POLICY "Allow all on patient_care_team" ON public.patient_care_team
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

-- Copy existing teams across (ids are stable, so re-running adds nothing).
INSERT INTO public.patient_care_team (id, patient_id, name, initials, role, title, sort_order)
SELECT 'ct-' || p.patient_id || '-' || t.ord,
       p.patient_id,
       t.m->>'name',
       nullif(t.m->>'initials', ''),
       nullif(t.m->>'role', ''),
       nullif(t.m->>'title', ''),
       t.ord
  FROM public.p360_profiles p,
       jsonb_array_elements(CASE WHEN jsonb_typeof(p.care_team) = 'array' THEN p.care_team ELSE '[]'::jsonb END)
         WITH ORDINALITY AS t(m, ord)
 WHERE coalesce(t.m->>'name', '') <> ''
ON CONFLICT (id) DO NOTHING;

-- The patient app's read of the care team, now from this table.
CREATE OR REPLACE FUNCTION public.patient_care_team(p_member_id text)
RETURNS TABLE (name text, title text, role text, initials text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.patient_can_access(p_member_id) THEN
    RAISE EXCEPTION 'Not allowed' USING errcode = '42501';
  END IF;
  RETURN QUERY
    SELECT c.name, c.title, c.role, c.initials
      FROM public.patient_care_team c
     WHERE c.patient_id = p_member_id AND c.status = 'current'
     ORDER BY c.sort_order, c.created_at;
END;
$$;

NOTIFY pgrst, 'reload schema';
