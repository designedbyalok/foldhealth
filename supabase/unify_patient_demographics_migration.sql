-- Unify each patient's Basic Profile (gender, dob, age, initials, language)
-- across every table, using the patients row (the Central Profile) as the single
-- source of truth. After the identity merges, a patient's rows in different
-- worklist tables share one id but carried different demographics, so the profile
-- showed different gender/DOB/age depending on which worklist opened it. Program
-- enrollments and worklist-specific fields are untouched, only the basic profile
-- is synced. Idempotent.

BEGIN;
SET LOCAL session_replication_role = replica;  -- bypass name/lifecycle guard triggers

-- Snapshot the tables this touches.
CREATE SCHEMA IF NOT EXISTS demo_bak;
DO $$
DECLARE t text;
DECLARE tbls text[] := ARRAY[
  'snp_worklist_members','ccm_worklist_members','awv_members','hcc_members',
  'hedis_members','jsa_members','all_patients','p360_profiles'
];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS demo_bak.%I AS SELECT * FROM public.%I', t, t);
  END LOOP;
END $$;

-- Text-demographic worklist tables (no dob column): gender, age, initials, language.
UPDATE public.snp_worklist_members t
SET gender = p.gender, age = p.age, initials = p.initials, language = p.language
FROM public.patients p WHERE t.id = p.id;

UPDATE public.awv_members t
SET gender = p.gender, age = p.age, initials = p.initials, language = p.language
FROM public.patients p WHERE t.id = p.id;

UPDATE public.jsa_members t
SET gender = p.gender, age = p.age, initials = p.initials, language = p.language
FROM public.patients p WHERE t.id = p.id;

-- Text tables that also carry a text dob.
UPDATE public.ccm_worklist_members t
SET gender = p.gender, age = p.age, dob = p.dob, initials = p.initials, language = p.language
FROM public.patients p WHERE t.id = p.id;

UPDATE public.hedis_members t
SET gender = p.gender, age = p.age, dob = p.dob, initials = p.initials, language = p.language
FROM public.patients p WHERE t.id = p.id;

-- hcc_members: one row per coding record (no age); date_of_birth is a DATE, and
-- patients.dob is MM/DD/YYYY text. Sync gender/initials/language for every record
-- and the parsed dob.
UPDATE public.hcc_members t
SET gender = p.gender, initials = p.initials, language = p.language,
    date_of_birth = CASE WHEN p.dob ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(p.dob, 'MM/DD/YYYY') ELSE NULL END
FROM public.patients p WHERE t.id = p.id;

-- all_patients cache: age is an integer (parse leading years from patients.age).
UPDATE public.all_patients t
SET gender = p.gender, dob = p.dob, initials = p.initials, language = p.language,
    age = NULLIF(regexp_replace(COALESCE(p.age,''), '\D.*$', ''), '')::int
FROM public.patients p WHERE t.id = p.id;

-- p360_profiles: keyed by patient_id; carries text date_of_birth + age.
UPDATE public.p360_profiles t
SET date_of_birth = p.dob, age = p.age
FROM public.patients p WHERE t.patient_id = p.id;

COMMIT;
