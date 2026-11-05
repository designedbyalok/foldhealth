-- Pharmacy worklist ↔ Pharmacy care program (PHARM) sync.
--
-- Run AFTER pharmacy_worklist_members_seed.sql (it reads the seeded
-- pharmacy_worklist_members rows). Idempotent.
--
--   1. Link pharmacy_worklist_members.patient_id by member_id. Since
--      patient_reident_member_id_migration.sql the patient identity is the
--      Fold ID (patients.id = member_id), so the member's own member_id IS
--      its patient id. Never by name: same-name patients can be different
--      people, and a name match would enroll the wrong one.
--   2. Every linked member gets a PHARM care program, so the invariant holds:
--      "pharmacy worklist member ⇒ enrolled in the Pharmacy Program", and the
--      program is there before anyone clicks the eye icon. The id matches what
--      addCareProgram generates (`pcp-{patientId}-PHARM`), so the app and this
--      backfill can never create two rows for one enrollment.
--   3. Re-key anything the app wrote against the first mock ids (phw-001 …
--      phw-010, before the members took Fold IDs 19401-19410): activity moves
--      to the Fold ID, and a phw-* program is re-keyed, or dropped when the
--      member already has its PHARM program.

BEGIN;

-- 3 runs first so step 2 sees the re-keyed programs.
UPDATE public.patient_program_activity
SET    patient_id = '194' || substr(patient_id, 6)
WHERE  patient_id ~ '^phw-0[0-9]{2}$';

DELETE FROM public.patient_care_programs c
WHERE  c.patient_id ~ '^phw-0[0-9]{2}$'
AND    EXISTS (
  SELECT 1 FROM public.patient_care_programs k
  WHERE k.patient_id = '194' || substr(c.patient_id, 6) AND k.code = c.code
);

UPDATE public.patient_care_programs
SET    id = 'pcp-194' || substr(patient_id, 6) || '-' || code,
       patient_id = '194' || substr(patient_id, 6)
WHERE  patient_id ~ '^phw-0[0-9]{2}$';

-- 1. Link by Fold ID.
UPDATE public.pharmacy_worklist_members
SET    patient_id = member_id
WHERE  (patient_id IS NULL OR patient_id = '')
AND    member_id IS NOT NULL AND member_id <> '';

-- 2. Seed the missing PHARM care program rows (one per linked patient).
INSERT INTO public.patient_care_programs
  (id, patient_id, code, name, acuity, status, status_color,
   start_date, end_date, last_updated, assignee, pcp, progress)
SELECT DISTINCT ON (m.patient_id)
  'pcp-' || m.patient_id || '-PHARM',
  m.patient_id,
  'PHARM',
  'Pharmacy Program (PHARM)',
  NULL,
  -- Gaps reopen every fill, so the program stays active: an untouched gap
  -- is New, anything already worked is Engaged. Colors from programStatus.js.
  CASE WHEN m.status = 'Open' THEN 'New' ELSE 'Engaged' END,
  CASE WHEN m.status = 'Open' THEN 'var(--primary-300)' ELSE 'var(--status-warning)' END,
  to_char(now(), 'MM/DD/YYYY'),
  '-',
  to_char(now(), 'MM/DD/YYYY'),
  COALESCE(m.assignee_name, 'Unassigned'),
  '-',
  0
FROM public.pharmacy_worklist_members m
WHERE m.patient_id IS NOT NULL AND m.patient_id <> ''
AND   NOT EXISTS (
  SELECT 1 FROM public.patient_care_programs c
  WHERE c.patient_id = m.patient_id AND c.code = 'PHARM'
)
ORDER BY m.patient_id, m.id
ON CONFLICT DO NOTHING;

COMMIT;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- Only the programs this backfill creates (worked programs carry a care plan
-- or activity; check before deleting):
--   DELETE FROM public.patient_care_programs
--   WHERE code = 'PHARM'
--   AND   patient_id IN (SELECT patient_id FROM public.pharmacy_worklist_members)
--   AND   id = 'pcp-' || patient_id || '-PHARM';
