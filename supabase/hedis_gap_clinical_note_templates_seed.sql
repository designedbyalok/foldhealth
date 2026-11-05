-- Seed one Clinical Note template into public.forms for every HEDIS gap
-- code the Care Gap Detail Drawer currently surfaces. The Clinical Note
-- workspace looks up a template by name when a user picks "Add Note" on
-- a gap row: until now only the CBP row had one, so every other gap fell
-- back to a generic body.
--
-- SHAPE
-- Each row is inserted with:
--   form_type = 'Note'  → shows up under Settings → Content → Forms > Notes
--                         and is eligible for the Care Gap workspace picker
--   category  = 'Care Gap'
--   status    = 'active'
-- IDs are left to the bigint sequence (no code hardcodes forms.id).
--
-- SAFETY
-- Each INSERT is guarded by `WHERE NOT EXISTS (… WHERE name = …)` so the
-- migration is idempotent and safe to re-run.  Hand-edits to a template's
-- description survive re-runs.
--
-- CBP Visit Note is intentionally NOT seeded here, it is already inserted
-- by supabase/forms_type_column_and_cbp_visit_note_migration.sql. If both
-- migrations run, the guard on `name` keeps this idempotent.

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'BCS Visit Note', 'Breast Cancer Screening: mammography documentation and follow-up plan.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'BCS Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'GSD3 Visit Note', 'Glycemic Status Assessment for Diabetes: HbA1c value, method, and management plan for members with HbA1c > 9%.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'GSD3 Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'EED Visit Note', 'Eye Exam for Patients with Diabetes, retinal exam findings, provider, and next screening date.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'EED Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'OMW Visit Note', 'Osteoporosis Management in Women Who Had a Fracture, BMD test or pharmacotherapy documentation.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'OMW Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'COL Visit Note', 'Colorectal Cancer Screening: modality (FIT / FIT-DNA / colonoscopy / sigmoidoscopy) and result.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'COL Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'KED Visit Note', 'Kidney Health Evaluation for Patients with Diabetes, eGFR and uACR results with staging.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'KED Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'COA-FS Visit Note', 'Care for Older Adults: Functional Status Assessment covering ADLs, IADLs, and cognitive status.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'COA-FS Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'COA-M Visit Note', 'Care for Older Adults: Medication Review with reconciled medication list and any changes.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'COA-M Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'BPD Visit Note', 'Blood Pressure Documentation: reading, method, position, and treatment plan.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'BPD Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'CCS Visit Note', 'Cervical Cancer Screening: Pap / HPV modality, result, and next screening date.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'CCS Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'CHL Visit Note', 'Chlamydia Screening in Women: test type, date, and follow-up plan.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'CHL Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'CIS-CMB10 Visit Note', 'Childhood Immunization Status (Combination 10): DTaP, IPV, MMR, HiB, Hep B, VZV, PCV, Hep A, RV, influenza documentation.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'CIS-CMB10 Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'COB Visit Note', 'Care for Older Adults: Body Mass Index / physical assessment documentation.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'COB Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'DEV Visit Note', 'Developmental Screening in the First Three Years, standardized tool used, score, and referral plan.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'DEV Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'IMA-CMB2 Visit Note', 'Immunizations for Adolescents (Combination 2): Meningococcal, Tdap, HPV documentation.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'IMA-CMB2 Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'LSC Visit Note', 'Lead Screening in Children: capillary or venous test, result, and follow-up.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'LSC Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'POLY-ACH Visit Note', 'Polypharmacy, Use of Multiple Anticholinergic Medications in Older Adults, reconciliation and deprescribing plan.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'POLY-ACH Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'PPC1A Visit Note', 'Prenatal Care: Timeliness of first prenatal visit within the first trimester or within 42 days of enrollment.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'PPC1A Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'PPC2A Visit Note', 'Postpartum Care: Postpartum visit on or between 7 and 84 days after delivery.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'PPC2A Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'SUPD Visit Note', 'Statin Use in Persons with Diabetes, statin prescription documentation and adherence.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'SUPD Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'TRC-EA Visit Note', 'Transitions of Care: Patient Engagement After Inpatient Discharge within 30 days.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'TRC-EA Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'TRC-MR Visit Note', 'Transitions of Care: Medication Reconciliation Post-Discharge within 30 days.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'TRC-MR Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'W30A Visit Note', 'Well-Child Visits in the First 15 Months of Life, visit count and provider documentation.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'W30A Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'W30B Visit Note', 'Well-Child Visits for Ages 15 Months–30 Months, visit count and provider documentation.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'W30B Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'WCV Visit Note', 'Well-Care Visits for Children, Adolescents, and Young Adults, annual well-visit documentation.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'WCV Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'APE Visit Note', 'Adult Preventive Exam: annual wellness visit documentation and preventive screenings.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'APE Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'FMC Visit Note', 'Follow-Up After Emergency Department Visit for Mental Illness, 7-day and 30-day follow-up documentation.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'FMC Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'MRP Visit Note', 'Medication Reconciliation Post-Discharge: reconciled medication list within 30 days of discharge.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'MRP Visit Note');

-- DSF-A / DSF-B (Depression Screening): the two carrier gaps for the
-- PHQ-2 → PHQ-9 depression screening workflow. The DSF-A Visit Note owns
-- the shared DOS + telehealth consent + PHQ-2 scoring; DSF-B Visit Note
-- carries the PHQ-9 severity band and matching care plan. DSF-A is the
-- billing carrier for both gaps, so a single note in production may
-- reference either template.
INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'DSF-A Visit Note', 'Depression Screening (PHQ-2): 2-item PHQ-2 with save-lock and PHQ-2-negative care plan.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'DSF-A Visit Note');

INSERT INTO public.forms (name, description, category, form_type, status, response_count, updated_at)
SELECT 'DSF-B Visit Note', 'Depression Follow-Up (PHQ-9): 9-item PHQ-9 with severity-band care plan (Minimal / Mild / Moderate / Severe) and Decline Follow-Up branch.', 'Care Gap', 'Note', 'active', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM public.forms WHERE name = 'DSF-B Visit Note');
