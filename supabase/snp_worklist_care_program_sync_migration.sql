-- SNP worklist ↔ SNP care program sync (backfill direction).
--
-- Forward direction lives in the app: addCareProgram('SNP') now calls
-- ensureSnpWorklistMembership, which inserts an snp_worklist_members row.
-- This migration handles the existing data:
--
--   1. Link snp_worklist_members.patient_id → patients.id by exact name
--      match (patient names are unique in the seed set). This is what makes
--      an SNP row click open the patient profile at all, the row handler
--      bails with a toast when patient_id is empty.
--   2. Unmatched members (no patients row of that name) self-link to their
--      own snp row id. PatientDetailView resolves ids across every worklist
--      slice, so a profile opened with the snpw-* id renders fine backed by
--      the SNP slice.
--   3. Every linked patient without an SNP care program gets one, so the
--      invariant holds: SNP worklist member ⇒ SNP care program enrolled.
--      start_date carries the member's trigger_date when present (that is
--      the closest thing to the real enrollment date), else today.

BEGIN;

-- 1. Name-match link to the patients table.
UPDATE public.snp_worklist_members s
SET    patient_id = p.id
FROM   public.patients p
WHERE  (s.patient_id IS NULL OR s.patient_id = '')
AND    p.name = s.name;

-- 2. Self-link fallback for members with no patients row.
UPDATE public.snp_worklist_members
SET    patient_id = id
WHERE  patient_id IS NULL OR patient_id = '';

-- 3. Seed the missing SNP care program rows, one per distinct linked
--    patient (two SNP rows for the same patient still mean one program).
INSERT INTO public.patient_care_programs
  (id, patient_id, code, name, acuity, status, status_color,
   start_date, end_date, last_updated, assignee, pcp, progress)
SELECT DISTINCT ON (s.patient_id)
  'pcp-' || s.patient_id || '-SNP-1',
  s.patient_id,
  'SNP',
  'SNP Care Program (SNP)',
  NULL,
  'New',
  'var(--primary-300)',
  COALESCE(NULLIF(s.trigger_date, ''), to_char(now(), 'MM/DD/YYYY')),
  '-',
  to_char(now(), 'MM/DD/YYYY'),
  'Unassigned',
  '-',
  0
FROM public.snp_worklist_members s
WHERE s.patient_id IS NOT NULL
AND   NOT EXISTS (
  SELECT 1 FROM public.patient_care_programs c
  WHERE c.patient_id = s.patient_id AND c.code = 'SNP'
)
ORDER BY s.patient_id, s.id
ON CONFLICT (id) DO NOTHING;

-- 4. Backfill the creation date on every pre-existing program row that never
--    got one (the UI used to seed start_date as '-' and only stamped it when
--    the status flipped to Enrolled). created_at is the enrollment moment,
--    so the display column derives from it. Applies to ALL programs, not
--    just SNP: the '-' bug was program-agnostic.
UPDATE public.patient_care_programs
SET    start_date = to_char(created_at, 'MM/DD/YYYY')
WHERE  (start_date IS NULL OR start_date = '' OR start_date = '-');

COMMIT;
