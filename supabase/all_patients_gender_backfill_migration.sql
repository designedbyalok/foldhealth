-- Backfill gender on the 100 'manual' all_patients rows: they seeded with
-- age but NULL gender, so the shared "(gender•age)" demo string next to the
-- patient name (AllPatientsRow renders it exactly like the TOC/HCC rows)
-- never showed. Assignment is by first name so it reads naturally; the two
-- ambiguous/neutral names fall to a deterministic id-parity bucket.

BEGIN;

UPDATE public.all_patients
SET gender = CASE split_part(name, ' ', 1)
  -- male first names in the seed + rename pools
  WHEN 'Aarav'  THEN 'M' WHEN 'Aditya' THEN 'M' WHEN 'Arjun'  THEN 'M'
  WHEN 'Dev'    THEN 'M' WHEN 'Ezra'   THEN 'M' WHEN 'Felix'  THEN 'M'
  WHEN 'Hugo'   THEN 'M' WHEN 'Ishaan' THEN 'M' WHEN 'Jasper' THEN 'M'
  WHEN 'Kabir'  THEN 'M' WHEN 'Karan'  THEN 'M' WHEN 'Lars'   THEN 'M'
  WHEN 'Miles'  THEN 'M' WHEN 'Otis'   THEN 'M' WHEN 'Owen'   THEN 'M'
  WHEN 'Rahul'  THEN 'M' WHEN 'Rhys'   THEN 'M' WHEN 'Rohan'  THEN 'M'
  WHEN 'Samar'  THEN 'M' WHEN 'Silas'  THEN 'M' WHEN 'Vikram' THEN 'M'
  WHEN 'Vivaan' THEN 'M'
  -- female first names
  WHEN 'Anaya'  THEN 'F' WHEN 'Clara'  THEN 'F' WHEN 'Diya'   THEN 'F'
  WHEN 'Elsie'  THEN 'F' WHEN 'Freya'  THEN 'F' WHEN 'Isha'   THEN 'F'
  WHEN 'Ivy'    THEN 'F' WHEN 'June'   THEN 'F' WHEN 'Kavya'  THEN 'F'
  WHEN 'Leela'  THEN 'F' WHEN 'Meera'  THEN 'F' WHEN 'Mira'   THEN 'F'
  WHEN 'Neha'   THEN 'F' WHEN 'Nisha'  THEN 'F' WHEN 'Nora'   THEN 'F'
  WHEN 'Opal'   THEN 'F' WHEN 'Petra'  THEN 'F' WHEN 'Priya'  THEN 'F'
  WHEN 'Riya'   THEN 'F' WHEN 'Sana'   THEN 'F' WHEN 'Tara'   THEN 'F'
  WHEN 'Vera'   THEN 'F'
  -- neutral names (Wren, …), deterministic parity on the numeric member id
  ELSE CASE WHEN (NULLIF(regexp_replace(member_id, '\D', '', 'g'), '')::bigint % 2) = 0 THEN 'F' ELSE 'M' END
END
WHERE gender IS NULL;

COMMIT;
