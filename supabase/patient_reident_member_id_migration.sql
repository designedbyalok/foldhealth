-- Patient re-identification: member_id becomes the patient identity.
--
-- Background: patients were keyed by context-specific synthetic ids (p3, awv-25,
-- snpw-001, hcc-42, hd11, ap-010, FOLD…) across ~26 tables, while member_id (the
-- "Fold ID" shown in the UI) was only a display attribute. This migration makes
-- member_id the identity everywhere:
--   1. fix 2 data anomalies (a shared member_id, and a missing one),
--   2. build a synthetic-id -> member_id map,
--   3. dedupe rows that collapse onto one member_id (tables with a unique key on
--      patient_id),
--   4. re-key patient_id in every referencing table to member_id,
--   5. set id = member_id on the one-row-per-patient source tables
--      (hcc_members is EXCLUDED: one row per coding record, so member_id repeats;
--      its member_id still feeds the map so refs pointing at hcc record ids re-key),
--   6. ensure every worklist member holds their worklist's care program under
--      their member_id.
--
-- Self-contained and idempotent: re-running recomputes the same member_ids and
-- finds nothing to change. Orphan references with no member_id (dangling hd*/epoch
-- ids) and the 'global' sticky-note sentinel are left untouched.
--
-- NOTE: run with a full backup. The operational rollout snapshotted every table
-- into schema reident_bak first (CREATE TABLE reident_bak.<t> AS SELECT * FROM
-- public.<t>); that snapshot is operational and intentionally not part of this
-- migration.

BEGIN;

-- Bypass lifecycle / attribution / name-guard triggers for this bulk re-key.
-- SET LOCAL auto-resets at COMMIT/ROLLBACK.
SET LOCAL session_replication_role = replica;

-- ── 1. Anomaly fixes (fresh, unique member_ids = max sane member_id + 1). ──────
--    Matches only the original synthetic rows, so it no-ops once already fixed.
UPDATE public.snp_worklist_members
SET member_id = (
  SELECT (max(m::bigint) + 1)::text FROM (
    SELECT member_id AS m FROM public.patients             WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.awv_members          WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.ccm_worklist_members WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.snp_worklist_members WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.hcc_members          WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.hedis_members        WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.jsa_members          WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.apcm_patients        WHERE member_id ~ '^[0-9]{4,6}$'
  ) x)
WHERE id = 'snpw-004' AND member_id = '10003';

UPDATE public.patients
SET member_id = (
  SELECT (max(m::bigint) + 1)::text FROM (
    SELECT member_id AS m FROM public.patients             WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.awv_members          WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.ccm_worklist_members WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.snp_worklist_members WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.hcc_members          WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.hedis_members        WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.jsa_members          WHERE member_id ~ '^[0-9]{4,6}$'
    UNION ALL SELECT member_id FROM public.apcm_patients        WHERE member_id ~ '^[0-9]{4,6}$'
  ) x)
WHERE id = 'p-inv-mt76hs5r' AND (member_id IS NULL OR member_id = '');

-- ── 2. Inline id -> member_id map (one row per source id). ────────────────────
CREATE TEMP TABLE _idmap ON COMMIT DROP AS
SELECT DISTINCT ON (old_id) old_id, member_id FROM (
  SELECT id AS old_id, member_id, 1 AS src FROM public.patients
  UNION ALL SELECT id, member_id, 1 FROM public.awv_members
  UNION ALL SELECT id, member_id, 1 FROM public.ccm_worklist_members
  UNION ALL SELECT id, member_id, 1 FROM public.snp_worklist_members
  UNION ALL SELECT id, member_id, 1 FROM public.hcc_members
  UNION ALL SELECT id, member_id, 1 FROM public.hedis_members
  UNION ALL SELECT id, member_id, 1 FROM public.jsa_members
  UNION ALL SELECT id, member_id, 1 FROM public.apcm_patients
  UNION ALL SELECT id, member_id, 2 FROM public.all_patients
) s
WHERE member_id IS NOT NULL AND member_id <> '' AND old_id IS NOT NULL
ORDER BY old_id, src;

-- ── 3. Dedupe rows that collapse onto one member_id (unique keys on patient_id). ─
DELETE FROM public.p360_profiles x USING (
  SELECT x2.ctid, row_number() OVER (
    PARTITION BY COALESCE((SELECT member_id FROM _idmap m WHERE m.old_id=x2.patient_id), x2.patient_id)
    ORDER BY x2.ctid) rn
  FROM public.p360_profiles x2
) d WHERE x.ctid = d.ctid AND d.rn > 1;

DELETE FROM public.ccm_billing_periods x USING (
  SELECT x2.ctid, row_number() OVER (
    PARTITION BY COALESCE((SELECT member_id FROM _idmap m WHERE m.old_id=x2.patient_id), x2.patient_id), x2.year_month
    ORDER BY x2.ctid) rn
  FROM public.ccm_billing_periods x2
) d WHERE x.ctid = d.ctid AND d.rn > 1;

DELETE FROM public.patient_care_plans x USING (
  SELECT x2.ctid, row_number() OVER (
    PARTITION BY COALESCE((SELECT member_id FROM _idmap m WHERE m.old_id=x2.patient_id), x2.patient_id), x2.program_id
    ORDER BY x2.ctid) rn
  FROM public.patient_care_plans x2
) d WHERE x.ctid = d.ctid AND d.rn > 1;

DELETE FROM public.patient_care_programs x USING (
  SELECT x2.ctid, row_number() OVER (
    PARTITION BY COALESCE((SELECT member_id FROM _idmap m WHERE m.old_id=x2.patient_id), x2.patient_id), x2.code
    ORDER BY (x2.status <> 'New') DESC, x2.created_at ASC, x2.ctid) rn
  FROM public.patient_care_programs x2
) d WHERE x.ctid = d.ctid AND d.rn > 1;

DELETE FROM public.pop_group_memberships x USING (
  SELECT x2.ctid, row_number() OVER (
    PARTITION BY x2.group_id, COALESCE((SELECT member_id FROM _idmap m WHERE m.old_id=x2.patient_id), x2.patient_id)
    ORDER BY x2.ctid) rn
  FROM public.pop_group_memberships x2
) d WHERE x.ctid = d.ctid AND d.rn > 1;

-- ── 4. Re-key patient_id in every referencing table via the map. ──────────────
DO $$
DECLARE t text;
DECLARE tbls text[] := ARRAY[
  'appointments','awv_members','call_details','call_sessions','care_plan_audit',
  'care_plan_links','care_plan_shares','ccm_billable_activities','ccm_billing_periods',
  'ccm_billing_reports','ccm_worklist_members','clinical_notes','hcc_activity_log',
  'p360_profiles','patient_care_plan_versions','patient_care_plans','patient_care_programs',
  'patient_clinical_events','patient_medications','patient_program_activity',
  'pop_group_memberships','program_documents','snp_worklist_members','sticky_note_history',
  'sticky_notes','tasks'
];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format(
      'UPDATE public.%I x SET patient_id = m.member_id FROM _idmap m '
      'WHERE x.patient_id = m.old_id AND x.patient_id <> m.member_id', t);
  END LOOP;
END $$;

-- ── 5. id = member_id on one-row-per-patient source tables (hcc_members excluded). ─
DO $$
DECLARE t text;
DECLARE tbls text[] := ARRAY[
  'patients','awv_members','ccm_worklist_members','snp_worklist_members',
  'hedis_members','jsa_members','apcm_patients','all_patients'
];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format(
      'UPDATE public.%I SET id = member_id '
      'WHERE member_id IS NOT NULL AND member_id <> '''' AND id <> member_id', t);
  END LOOP;
END $$;

-- ── 6. Worklist ⇒ care-program invariant (each member's program under member_id). ─
INSERT INTO public.patient_care_programs
  (id, patient_id, code, name, acuity, status, status_color,
   start_date, end_date, last_updated, assignee, pcp, progress)
SELECT 'pcp-' || s.id || '-SNP-1', s.id, 'SNP', 'SNP Care Program (SNP)',
       NULL,'New','var(--primary-300)', to_char(now(),'MM/DD/YYYY'),'-',to_char(now(),'MM/DD/YYYY'),'Unassigned','-',0
FROM public.snp_worklist_members s WHERE s.id IS NOT NULL AND s.id <> ''
ON CONFLICT (patient_id, code) DO NOTHING;

INSERT INTO public.patient_care_programs
  (id, patient_id, code, name, acuity, status, status_color,
   start_date, end_date, last_updated, assignee, pcp, progress)
SELECT 'pcp-' || c.id || '-CCM', c.id, 'CCM', 'Chronic Care Management (CCM)',
       NULL,'New','var(--primary-300)', to_char(now(),'MM/DD/YYYY'),'-',to_char(now(),'MM/DD/YYYY'),'Unassigned','-',0
FROM public.ccm_worklist_members c WHERE c.id IS NOT NULL AND c.id <> ''
ON CONFLICT (patient_id, code) DO NOTHING;

INSERT INTO public.patient_care_programs
  (id, patient_id, code, name, acuity, status, status_color,
   start_date, end_date, last_updated, assignee, pcp, progress)
SELECT 'pcp-' || a.id || '-AWV', a.id, 'AWV', 'Annual Wellness Visit (AWV)',
       NULL,'New','var(--primary-300)', to_char(now(),'MM/DD/YYYY'),'-',to_char(now(),'MM/DD/YYYY'),'Unassigned','-',0
FROM public.awv_members a WHERE a.id IS NOT NULL AND a.id <> ''
ON CONFLICT (patient_id, code) DO NOTHING;

INSERT INTO public.patient_care_programs
  (id, patient_id, code, name, acuity, status, status_color,
   start_date, end_date, last_updated, assignee, pcp, progress)
SELECT 'pcp-' || p.id || '-TOC IP', p.id, 'TOC IP', 'Transition of Care - IP (TOC IP)',
       NULL,'New','var(--primary-300)', to_char(now(),'MM/DD/YYYY'),'-',to_char(now(),'MM/DD/YYYY'),'Unassigned','-',0
FROM public.patients p WHERE p.id IS NOT NULL AND p.id <> ''
ON CONFLICT (patient_id, code) DO NOTHING;

COMMIT;
