-- Re-fix: duplicate "Annette Brave" rows in the SNP and CCM worklists.
--
-- WHY THIS REGRESSED
-- annette_brave_identity_merge_migration.sql deduped the worklist rows by
-- their numeric primary key:
--     UPDATE snp_worklist_members ... WHERE id = '10039';
--     DELETE FROM snp_worklist_members WHERE id = '10003';
--     UPDATE ccm_worklist_members ... WHERE id = '10045';
-- The later member_id re-identification (patient_reident_member_id_migration.sql,
-- PR #372) rewrote every worklist primary key to a synthetic code and moved the
-- numeric value into `member_id`, so `WHERE id = '10039'` no longer matched and
-- the dedup silently no-oped. Only the leftover display rows duplicated — the
-- single patient profile (11089) and all programs/plans stayed consolidated.
--
-- KEY CHOICE (important)
-- Do NOT key on `member_id`: it is NOT unique in these tables (e.g. member_id
-- '10003' belongs to BOTH snpw-006 "Annette Brave" AND snpw-004
-- "Ralph Halvorson"), so a member_id delete would take an unrelated patient
-- with it. The identity merge already declared 11089 the canonical Annette, so
-- the safe, id-scheme-agnostic key is: the name is "Annette Brave" AND the row
-- is not the canonical 11089 row. That can never match a different person.

BEGIN;

-- Snapshot before deleting (idempotent; keeps the first snapshot).
CREATE SCHEMA IF NOT EXISTS annette_bak;
CREATE TABLE IF NOT EXISTS annette_bak.snp_worklist_annette_dupes AS
  SELECT * FROM public.snp_worklist_members
  WHERE lower(name) = 'annette brave' AND id::text <> '11089';
CREATE TABLE IF NOT EXISTS annette_bak.ccm_worklist_annette_dupes AS
  SELECT * FROM public.ccm_worklist_members
  WHERE lower(name) = 'annette brave' AND id::text <> '11089';

DELETE FROM public.snp_worklist_members
  WHERE lower(name) = 'annette brave' AND id::text <> '11089';
DELETE FROM public.ccm_worklist_members
  WHERE lower(name) = 'annette brave' AND id::text <> '11089';

COMMIT;
