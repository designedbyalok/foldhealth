-- Amy Phillips (11103) becomes a real-number test patient, +91 97185 13584,
-- a number the team owns, so SMS from Messages reaches her. Same as the dev
-- database. Safe to run more than once.
-- Review note: 11103 already exists in all_patients; this only changes its
-- phone. No rows are inserted or deleted.

UPDATE public.all_patients  SET phone = '+919718513584' WHERE id = '11103';
UPDATE public.patients      SET phone = '+919718513584' WHERE id = '11103';

DO $$
BEGIN
  IF to_regclass('public.patient_conversations') IS NOT NULL THEN
    UPDATE public.patient_conversations
       SET patient_phone = '+919718513584'
     WHERE patient_id = '11103'
       AND patient_phone IS DISTINCT FROM '+919718513584';
  END IF;
END $$;
