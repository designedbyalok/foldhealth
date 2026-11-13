-- Section 1557 (45 CFR 92.201): a patient with limited English proficiency is
-- offered a qualified interpreter; an adult family member may interpret only
-- when the patient asks for it after that offer, and the choice is documented.
-- interpreter_offer records that once per patient:
--   { "status": "qualified" | "declined", "language": "Spanish",
--     "name": "Lucia", "relationship": "Daughter",   -- when declined
--     "recordedBy": "Fold Demo", "recordedAt": "2026-11-13T10:00:00Z" }
-- NULL means the offer hasn't been recorded yet.
ALTER TABLE public.patient_preferences ADD COLUMN IF NOT EXISTS interpreter_offer jsonb;

-- Demo patients whose charts already say they need a Spanish interpreter.
UPDATE public.patient_preferences SET needs_interpreter = true, preferred_language = 'Spanish'
 WHERE patient_id IN ('11119', '11053');
