-- all_patients becomes the master list of every patient in the app.
--
-- Purpose: Comms, Messages and the other patient pickers read
-- public.all_patients, but it only held part of the population. Patients that
-- exist only on a program worklist (TOC, HEDIS, CCM, CMP, SNP, AWV, JSA, APCM,
-- HCC) could not be found there. This migration copies every missing patient
-- into all_patients once, and adds AFTER INSERT triggers so a patient added to
-- any of those worklists later is mirrored automatically.
--
-- Tables read (each guarded with to_regclass, skipped when absent):
--   patients (source 'toc'), hedis_members ('hedis'), ccm_worklist_members
--   ('ccm'), cmp_members ('cmp'), snp_worklist_members ('snp'), awv_members
--   ('awv'), jsa_members ('jsa'), apcm_patients ('apcm'), hcc_members ('hcc').
--   Leads and contacts are not patients and are not read.
-- Table written: public.all_patients (INSERT only).
-- Objects created: functions public.all_patients_mirror_insert(jsonb, text) and
--   public.sync_all_patients_from_source(), and trigger all_patients_sync on
--   each source table above.
--
-- Insert only: existing all_patients rows are never updated or deleted, and
-- ON CONFLICT (id) DO NOTHING guards every insert.
--
-- Mapping: id = member_id = the Fold ID, COALESCE(NULLIF(member_id, ''), id)
-- of the source row. name, gender, language, email, phone, city, state, zip,
-- ipa and hp_code are copied as-is when the source has them (phones in these
-- tables are already demo-safe, see demo_patient_phones_migration.sql).
-- age: leading digits of the source text ('72y 4m' -> 72), else NULL; for
-- hcc_members it is computed from date_of_birth. dob: source dob text
-- (MM/DD/YYYY), or hcc_members.date_of_birth formatted MM/DD/YYYY. initials:
-- the source initials, else first letters of the first and last name.
--
-- Dedupe rules (a source row is skipped when any of these hold):
--   1. all_patients already has a row whose id or member_id equals its Fold ID
--      (compared trimmed, case-insensitive, ignoring a leading '#');
--   2. all_patients already has a row with the same normalized name (trimmed,
--      collapsed spaces, case-insensitive). Patient names are unique per
--      person in this dataset (unique_patient_names_migration.sql), so a name
--      match is the same person filed under another id. This is the safer
--      option: it also skips name matches whose dob is unknown or differs.
--      Known limitation: a genuinely new patient who shares an exact name with
--      an existing one is not mirrored and has to be added by hand.
--   3. Within one run, sources are processed richest first (patients > hedis >
--      ccm > cmp > snp > awv > jsa > apcm > hcc) and rows by id, so a person on
--      several worklists, or with several rows on one (cmp enrollments, hcc
--      coding records), lands once, from the richest source.
--
-- source: a short tag of the origin table. If a CHECK constraint on
-- all_patients rejects the tag (older environments limited it to
-- toc/hcc/manual), the row is stored with source 'manual' instead.
--
-- Triggers: AFTER INSERT FOR EACH ROW, SECURITY INVOKER. The all_patients
-- write policy ("all_patients_write") already allows authenticated users and
-- the service role bypasses RLS, so no SECURITY DEFINER is needed. A failed
-- mirror never blocks the worklist insert: the error is caught and raised as a
-- NOTICE.
--
-- Idempotent: CREATE OR REPLACE for functions, DROP TRIGGER IF EXISTS before
-- CREATE TRIGGER, and a re-run finds every patient already present.
--
-- Review note (PR Autopilot): blast radius is INSERTs into public.all_patients
-- plus two functions and one AFTER INSERT trigger per source table. No UPDATE,
-- DELETE, TRUNCATE or DROP of data; no auth or storage schema; no policy
-- changes; EXECUTE is revoked from anon. Inserted ids follow id = member_id
-- (the Fold ID) and the dedupe rules above prevent duplicate patients. Verify
-- after running with:
--   SELECT source, count(*) FROM public.all_patients GROUP BY 1 ORDER BY 1;
--   SELECT tgrelid::regclass FROM pg_trigger WHERE tgname = 'all_patients_sync';

BEGIN;

-- Copies one source row (as jsonb) into all_patients unless that patient is
-- already there. Returns true when a row was inserted.
CREATE OR REPLACE FUNCTION public.all_patients_mirror_insert(src jsonb, src_tag text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id    text := COALESCE(NULLIF(btrim(src->>'member_id'), ''), NULLIF(btrim(src->>'id'), ''));
  v_key   text;
  v_name  text := NULLIF(btrim(regexp_replace(COALESCE(src->>'name', ''), '\s+', ' ', 'g')), '');
  v_parts text[];
  v_init  text := NULLIF(btrim(src->>'initials'), '');
  v_dob   text := NULLIF(btrim(src->>'dob'), '');
  v_age   integer := substring(src->>'age' FROM '^\s*(\d{1,3})')::integer;
  v_birth date;
  v_rows  integer;
BEGIN
  IF v_id IS NULL OR v_name IS NULL THEN
    RETURN false;
  END IF;
  v_key := lower(regexp_replace(v_id, '^#', ''));

  IF EXISTS (
    SELECT 1
    FROM public.all_patients a
    WHERE a.id = v_id
       OR lower(regexp_replace(btrim(COALESCE(a.id, '')), '^#', '')) = v_key
       OR lower(regexp_replace(btrim(COALESCE(a.member_id, '')), '^#', '')) = v_key
       OR lower(btrim(regexp_replace(COALESCE(a.name, ''), '\s+', ' ', 'g'))) = lower(v_name)
  ) THEN
    RETURN false;
  END IF;

  -- hcc_members keeps a DATE date_of_birth and no age.
  IF (src->>'date_of_birth') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_birth := (src->>'date_of_birth')::date;
    v_dob := COALESCE(v_dob, to_char(v_birth, 'MM/DD/YYYY'));
    v_age := COALESCE(v_age, date_part('year', age(current_date::timestamp, v_birth::timestamp))::integer);
  END IF;

  IF v_init IS NULL THEN
    v_parts := string_to_array(v_name, ' ');
    v_init := upper(left(v_parts[1], 1)
      || CASE WHEN cardinality(v_parts) > 1 THEN left(v_parts[cardinality(v_parts)], 1) ELSE '' END);
  END IF;

  FOR v_try IN 1..2 LOOP
    BEGIN
      INSERT INTO public.all_patients
        (id, member_id, source, name, initials, gender, age, dob, language,
         email, phone, city, state, zip, ipa, hp_code)
      VALUES
        (v_id, v_id,
         CASE WHEN v_try = 1 THEN src_tag ELSE 'manual' END,
         v_name, v_init,
         NULLIF(btrim(src->>'gender'), ''),
         v_age, v_dob,
         COALESCE(NULLIF(btrim(src->>'language'), ''), 'en'),
         NULLIF(btrim(src->>'email'), ''),
         NULLIF(btrim(src->>'phone'), ''),
         NULLIF(btrim(src->>'city'), ''),
         NULLIF(btrim(src->>'state'), ''),
         NULLIF(btrim(src->>'zip'), ''),
         NULLIF(btrim(src->>'ipa'), ''),
         NULLIF(btrim(src->>'hp_code'), ''))
      ON CONFLICT (id) DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RETURN v_rows > 0;
    EXCEPTION WHEN check_violation THEN
      -- A source CHECK that only allows toc/hcc/manual: retry as 'manual'.
      IF v_try = 2 OR src_tag = 'manual' THEN
        RAISE;
      END IF;
    END;
  END LOOP;
  RETURN false;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.sync_all_patients_from_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  BEGIN
    PERFORM public.all_patients_mirror_insert(to_jsonb(NEW), TG_ARGV[0]);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'sync_all_patients_from_source: %.% row % not mirrored to all_patients: %',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(NEW)->>'id', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

-- Not callable signed out. Authenticated users can already write all_patients
-- directly, so keeping EXECUTE for them adds nothing new.
REVOKE ALL ON FUNCTION public.all_patients_mirror_insert(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_all_patients_from_source() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.all_patients_mirror_insert(jsonb, text) FROM anon;
    REVOKE ALL ON FUNCTION public.sync_all_patients_from_source() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.all_patients_mirror_insert(jsonb, text) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.all_patients_mirror_insert(jsonb, text) TO service_role;
  END IF;
END $$;

-- 1. Backfill, richest source first.
DO $$
DECLARE
  s       record;
  r       record;
  n_added integer;
  n_total integer := 0;
BEGIN
  IF to_regclass('public.all_patients') IS NULL THEN
    RAISE NOTICE 'all_patients backfill: public.all_patients not found, nothing to do';
    RETURN;
  END IF;

  FOR s IN
    SELECT * FROM (VALUES
      (1, 'patients',             'toc'),
      (2, 'hedis_members',        'hedis'),
      (3, 'ccm_worklist_members', 'ccm'),
      (4, 'cmp_members',          'cmp'),
      (5, 'snp_worklist_members', 'snp'),
      (6, 'awv_members',          'awv'),
      (7, 'jsa_members',          'jsa'),
      (8, 'apcm_patients',        'apcm'),
      (9, 'hcc_members',          'hcc')
    ) AS v(priority, tbl, tag)
    ORDER BY priority
  LOOP
    IF to_regclass('public.' || s.tbl) IS NULL THEN
      RAISE NOTICE 'all_patients backfill: public.% not found, skipped', s.tbl;
      CONTINUE;
    END IF;

    n_added := 0;
    FOR r IN EXECUTE format('SELECT to_jsonb(t) AS j FROM public.%I t ORDER BY t.id', s.tbl) LOOP
      BEGIN
        IF public.all_patients_mirror_insert(r.j, s.tag) THEN
          n_added := n_added + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'all_patients backfill: public.% row % not copied: %', s.tbl, r.j->>'id', SQLERRM;
      END;
    END LOOP;

    RAISE NOTICE 'all_patients backfill: % added from public.%', n_added, s.tbl;
    n_total := n_total + n_added;
  END LOOP;

  RAISE NOTICE 'all_patients backfill: % added in total', n_total;
END $$;

-- 2. Keep it in sync: mirror future worklist inserts.
DO $$
DECLARE
  s record;
BEGIN
  IF to_regclass('public.all_patients') IS NULL THEN
    RETURN;
  END IF;

  FOR s IN
    SELECT * FROM (VALUES
      ('patients',             'toc'),
      ('hedis_members',        'hedis'),
      ('ccm_worklist_members', 'ccm'),
      ('cmp_members',          'cmp'),
      ('snp_worklist_members', 'snp'),
      ('awv_members',          'awv'),
      ('jsa_members',          'jsa'),
      ('apcm_patients',        'apcm'),
      ('hcc_members',          'hcc')
    ) AS v(tbl, tag)
  LOOP
    -- Plain or partitioned tables only; an AFTER row trigger cannot go on a view.
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.oid = to_regclass('public.' || s.tbl) AND c.relkind IN ('r', 'p')
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS all_patients_sync ON public.%I', s.tbl);
    EXECUTE format(
      'CREATE TRIGGER all_patients_sync AFTER INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.sync_all_patients_from_source(%L)',
      s.tbl, s.tag);
  END LOOP;
END $$;

COMMIT;
