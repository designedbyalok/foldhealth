-- A patient's family, caregivers and decision makers (Add Family, Caregivers
-- & Decision Makers drawer, Figma Mar-Present 2026 4801:13694).
--
-- One row per person. A person is either a Fold member (related_patient_id,
-- whose name / email / phone / date of birth come from their own record) or
-- someone outside Fold (name, email and phones typed in). Their roles:
-- caregiver, emergency contact, and at most one of Decision Maker /
-- Alternate Decision Maker, with the authority type and the patient's Legal
-- Authority documents (program_documents ids) that back it.
--
-- Send To and Protect links read these people as the patient's contacts.
-- Additive and idempotent: safe to run more than once. Until it runs, people
-- added in the drawer last only for the session.

CREATE TABLE IF NOT EXISTS public.patient_family_members (
  id                    text PRIMARY KEY,
  patient_id            text NOT NULL,
  related_patient_id    text,
  name                  text NOT NULL,
  relationship          text NOT NULL,
  email                 text,
  phone                 text,
  additional_phones     jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_caregiver          boolean NOT NULL DEFAULT false,
  is_emergency_contact  boolean NOT NULL DEFAULT false,
  decision_maker        text CHECK (decision_maker IN ('Decision Maker', 'Alternate Decision Maker')),
  authority_type        text CHECK (authority_type IN ('Legal Guardian', 'Healthcare Agent')),
  document_ids          jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_family_members_patient_idx ON public.patient_family_members (patient_id);
-- "Member is identified as family & caregiver for N Members" looks people up the other way.
CREATE INDEX IF NOT EXISTS patient_family_members_related_idx ON public.patient_family_members (related_patient_id);
-- One holder per decision-maker role, and a Fold member listed once per patient.
CREATE UNIQUE INDEX IF NOT EXISTS patient_family_members_one_dm
  ON public.patient_family_members (patient_id, decision_maker) WHERE decision_maker IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS patient_family_members_one_member
  ON public.patient_family_members (patient_id, related_patient_id) WHERE related_patient_id IS NOT NULL;

ALTER TABLE public.patient_family_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_family_members" ON public.patient_family_members;
CREATE POLICY "Allow all on patient_family_members" ON public.patient_family_members
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

NOTIFY pgrst, 'reload schema';
