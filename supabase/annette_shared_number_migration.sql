-- Annette Brave (11089), the team's test patient, moves to +91 91753 67487,
-- a real number we own, and shares it with two demo family members, Liam
-- Johnson and Ava Carter (FCS-5677: SMS for a shared phone number). Same as
-- the dev database. Safe to run more than once.
-- Review note: 11089 already exists in all_patients, patients and
-- hedis_members; this only changes its phone. The two family rows are new,
-- with id = member_id and a prefix no real Fold ID uses.

-- Annette's number everywhere a patient phone lives.
UPDATE public.all_patients  SET phone = '+919175367487' WHERE id = '11089';
UPDATE public.patients      SET phone = '+919175367487' WHERE id = '11089';
UPDATE public.hedis_members SET phone = '+919175367487' WHERE lower(trim(name)) = 'annette brave';

-- Her son and daughter on the same number. Ids are prefixed so they can
-- never overwrite a real patient.
INSERT INTO public.all_patients (id, member_id, source, name, initials, gender, age, language, phone, family_id)
VALUES
  ('sms-family-11089-liam', 'sms-family-11089-liam', 'manual', 'Liam Johnson', 'LJ', 'M', 34, 'en', '+919175367487', '11089'),
  ('sms-family-11089-ava',  'sms-family-11089-ava', 'manual', 'Ava Carter',   'AC', 'F', 31, 'en', '+919175367487', '11089')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, family_id = EXCLUDED.family_id, member_id = EXCLUDED.member_id;

-- Comms threads already opened with Annette follow her new number.
DO $$
BEGIN
  IF to_regclass('public.patient_conversations') IS NOT NULL THEN
    UPDATE public.patient_conversations
       SET patient_phone = '+919175367487'
     WHERE patient_id = '11089'
       AND patient_phone IS DISTINCT FROM '+919175367487';
  END IF;
END $$;
