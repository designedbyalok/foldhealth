-- Care team per profile location (Figma P360 Revamp 3752:379274).
--
-- A member's care team can differ by location (IPA): the Central Profile's
-- team, and one per health plan profile (FoldHealth, CCPP Health, ...). The
-- location is the profile id the P360 banner's profile dropdown uses
-- ('central', 'fold', 'ccpp', ...). Existing rows are the Central Profile's
-- team, so the column defaults to 'central' and nothing changes for them.
--
-- From the Central Profile a user can view and edit any location's team;
-- with a location picked at the top of the banner they edit only that one
-- (enforced in the app).
--
-- Additive and idempotent. No seed: existing rows become the Central team,
-- and location teams start empty until someone adds members.
-- Ask Alok Kumar to run this migration on Supabase.

ALTER TABLE public.patient_care_team
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'central';

DROP INDEX IF EXISTS public.patient_care_team_patient_idx;
CREATE INDEX IF NOT EXISTS patient_care_team_patient_idx ON public.patient_care_team (patient_id, location, status);

-- The patient app shows the member's Central Profile team, not every
-- location's team mixed together.
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
     WHERE c.patient_id = p_member_id AND c.status = 'current' AND c.location = 'central'
     ORDER BY c.sort_order, c.created_at;
END;
$$;

NOTIFY pgrst, 'reload schema';
