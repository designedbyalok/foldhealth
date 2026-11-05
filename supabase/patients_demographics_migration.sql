-- Patient demographics: the Update Member drawer edits name / DOB / gender /
-- contact fields, but `patients` had no columns for dob, email, phone, city,
-- or state, so those edits could never persist (the banner's DOB even
-- rendered a hardcoded fallback). Add the columns; the app's patientMapper
-- gains the same fields in lockstep.

BEGIN;

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dob   TEXT;  -- MM/DD/YYYY, matching UI format
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS city  TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS state TEXT;

COMMIT;
