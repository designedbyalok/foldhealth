-- Alok Kumar (11052) becomes a second real-number test patient, +91 78703
-- 87321, a number the team owns, so SMS from Messages reaches him. Two demo
-- family members share his number (FCS-5677: SMS for a shared phone number).
-- Safe to run more than once, on dev and on production.
-- Review note: 11052 already exists in patients (same person, id =
-- member_id); this adds the matching all_patients row Comms reads and sets
-- the phone. The two family rows are new, with id = member_id and a prefix no
-- real Fold ID uses.

-- TOC patient record.
UPDATE public.patients SET phone = '+917870387321' WHERE id = '11052';

-- Comms picks patients from all_patients.
INSERT INTO public.all_patients (id, source, member_id, name, initials, gender, age, language, email, phone, state)
VALUES ('11052', 'manual', '11052', 'Alok Kumar', 'AK', 'M', 28, 'en', 'alok.kumar@email.com', '+917870387321', 'CA')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone;

-- His family on the same number. Prefixed ids never collide with a real patient.
INSERT INTO public.all_patients (id, member_id, source, name, initials, gender, age, language, phone, family_id)
VALUES
  ('sms-family-11052-priya', 'sms-family-11052-priya', 'manual', 'Priya Kumar', 'PK', 'F', 27, 'en', '+917870387321', '11052'),
  ('sms-family-11052-rohan', 'sms-family-11052-rohan', 'manual', 'Rohan Kumar', 'RK', 'M', 6,  'en', '+917870387321', '11052')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, family_id = EXCLUDED.family_id, member_id = EXCLUDED.member_id;

-- Any Comms thread already opened with him follows the number.
DO $$
BEGIN
  IF to_regclass('public.patient_conversations') IS NOT NULL THEN
    UPDATE public.patient_conversations
       SET patient_phone = '+917870387321'
     WHERE patient_id = '11052'
       AND patient_phone IS DISTINCT FROM '+917870387321';
  END IF;
END $$;
