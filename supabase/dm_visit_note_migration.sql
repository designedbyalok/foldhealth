-- DM (Diabetes Management) Note Template + Form linkage
-- and audit fix for existing templates missing a Form row.
--
-- WHY
-- DM gap code (Diabetes HbA1c Control) had a measure name and mock data but
-- no entry in GAP_TEMPLATES and no row in public.forms. The Care Gap
-- Detail Drawer fell back to "Coming soon" for DM, and no Form existed to
-- back the template. This migration seeds the missing Form rows so every
-- Note Template in GAP_TEMPLATES (including the new DM template) has a
-- corresponding Form with form_type='Note', category='Care Gap'.
--
-- WHAT THIS ADDS
-- 1. DM Visit Note form (covers the new DM template added to
--    ClinicalNotePanel.utils.js GAP_TEMPLATES.DM).
-- 2. Five missing forms for existing templates whose names used a
--    hyphenated variant in the original seed and therefore did not match
--    the GAP_TEMPLATES key:
--    CISCMG10, IMACMB2, POLYACH, TRCEA, TRCMA
--    Each is inserted with the exact gap-code name so
--    `${code} Visit Note` lookups succeed.
--
-- SAFETY
-- All inserts are guarded by WHERE NOT EXISTS on name, so re-running is
-- idempotent and hand-edits to descriptions survive.

-- DM Visit Note: Diabetes Management (comprehensive HbA1c, foot/eye, BP, nephropathy)
INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'DM Visit Note',
       'Diabetes Management: HbA1c, diabetes type/management, dilated eye and foot exams, blood pressure, nephropathy screening, and care plan.',
       'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'DM Visit Note');

-- Missing forms for existing templates (hyphen mismatches in original seed)
INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'CISCMG10 Visit Note',
       'Childhood Immunization Status (Combination 10): DTaP, IPV, MMR, HiB, Hep B, VZV, PCV, Hep A, RV, influenza documentation.',
       'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'CISCMG10 Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'IMACMB2 Visit Note',
       'Immunizations for Adolescents (Combination 2): Meningococcal, Tdap, HPV documentation.',
       'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'IMACMB2 Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'POLYACH Visit Note',
       'Polypharmacy, Use of Multiple Anticholinergic Medications in Older Adults, reconciliation and deprescribing plan.',
       'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'POLYACH Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'TRCEA Visit Note',
       'Transitions of Care: Patient Engagement After Inpatient Discharge within 30 days.',
       'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'TRCEA Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'TRCMA Visit Note',
       'Transitions of Care: Medication Reconciliation Post-Discharge within 30 days.',
       'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'TRCMA Visit Note');
