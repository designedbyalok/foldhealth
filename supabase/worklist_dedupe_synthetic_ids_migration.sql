-- Remove duplicate worklist display rows left over from the pre-reident id
-- scheme, across every worklist table.
--
-- BACKGROUND
-- patient_reident_member_id_migration.sql (PR #372) made the canonical worklist
-- row key `id = member_id` (the Fold ID). But scripts/seed.js still seeds rows
-- with a synthetic `id` (snpw-001, ccmw-002, ap-004, FOLD100001, …) taken from
-- the mock data, while `member_id` resolves to the Fold ID. So each seed run
-- inserts a second, synthetic-id row for a patient who already has a canonical
-- `id = member_id` row — a duplicate that shows in the worklist.
--
-- SAFE DEDUP RULE
-- A row is a duplicate iff `id <> member_id` AND a same-name canonical row
-- (`id = member_id`) exists in the SAME table. The canonical row is always kept.
-- Verified before writing this: every such synthetic row has a NULL patient_id
-- and no care programs of its own (its member_id's programs, if any, belong to
-- the surviving canonical row), so nothing real is lost. member_id is NOT used
-- as the key — it is not unique here (e.g. '10003' is shared by an "Annette
-- Brave" and a "Ralph Halvorson" leftover), so a member_id delete would take an
-- unrelated patient with it.
--
-- Idempotent: re-running deletes nothing once the synthetic rows are gone.

BEGIN;

CREATE SCHEMA IF NOT EXISTS worklist_bak;

-- One helper per table: snapshot the synthetic duplicates, then delete them.
-- (No dynamic SQL — each worklist table is spelled out so the snapshot schema
--  is explicit and reviewable.)

-- SNP
CREATE TABLE IF NOT EXISTS worklist_bak.snp_dupes AS
  SELECT * FROM public.snp_worklist_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.snp_worklist_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);
DELETE FROM public.snp_worklist_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.snp_worklist_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);

-- CCM
CREATE TABLE IF NOT EXISTS worklist_bak.ccm_dupes AS
  SELECT * FROM public.ccm_worklist_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.ccm_worklist_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);
DELETE FROM public.ccm_worklist_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.ccm_worklist_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);

-- AWV
CREATE TABLE IF NOT EXISTS worklist_bak.awv_dupes AS
  SELECT * FROM public.awv_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.awv_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);
DELETE FROM public.awv_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.awv_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);

-- HEDIS
CREATE TABLE IF NOT EXISTS worklist_bak.hedis_dupes AS
  SELECT * FROM public.hedis_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.hedis_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);
DELETE FROM public.hedis_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.hedis_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);

-- JSA
CREATE TABLE IF NOT EXISTS worklist_bak.jsa_dupes AS
  SELECT * FROM public.jsa_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.jsa_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);
DELETE FROM public.jsa_members d
  WHERE d.id::text <> d.member_id::text
    AND EXISTS (SELECT 1 FROM public.jsa_members c
                WHERE c.id::text = c.member_id::text AND c.name = d.name);

COMMIT;
