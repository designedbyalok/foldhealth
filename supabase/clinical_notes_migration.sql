-- Persistence for HEDIS Clinical Notes (CBP Visit Note today; more forms
-- will plug in via form_type).
--
-- WHY
-- The HEDIS Clinical Note workspace ("Add Note" inside the Care Gap Detail
-- Drawer) has had four save handlers (Save as Draft, Sign & Save, Sign and
-- Print, Submit for Review) since the initial cut, but none of them
-- persisted the actual note body: they only logged a caregap_activity row
-- and (for the two sign paths) mutated an in-memory gap status. That means:
--   • CBP-specific fields (bpDate, systolic/diastolic, location, and the
--     five radio-group answers) vanished on reload.
--   • The Care Gap Detail Drawer's Clinical Notes tab could never render a
--     list because there was nothing to list, it fell through to a
--     "coming soon" placeholder.
--   • The P360 patient profile's Notes tab was also a placeholder for the
--     same reason.
--   • Submit-for-review created a sign-off task but hard-coded
--     assigned_to_id: null, so the tasks_emit_notifications trigger had
--     no recipient: the reviewer was never actually notified.
--
-- WHAT THIS ADDS
--   1. public.clinical_notes, one row per (member, gap-code(s), form_type)
--      note instance. Payload rides in a JSONB column so form_type can
--      evolve without a schema change per gap.
--   2. Indexes on (patient_id, updated_at desc) for the P360 Notes tab,
--      (hedis_member_id, status) for the Care Gap Drawer tab, and
--      (review_task_id) so completing a review can flip the note to
--      status='signed' via one lookup.
--   3. RLS: mirrors the tasks posture (authenticated SELECT-all;
--      INSERT/UPDATE gated on author or reviewer identity). No anon
--      policies, consistent with drop_remaining_anon_policies.sql.
--
-- DATA MODEL NOTES
--   • patient_id is text so it lines up with the sticky_notes convention
--     already used across the P360 surface (aaa_bootstrap_missing_tables
--     _migration.sql:1380). We'll never join it against uuid patient rows.
--   • hedis_member_id is text and matches hedis_members.id.
--   • gap_codes is text[] so the single-gap inline workspace and the
--     future multi-gap consolidated note share one row shape, mirrors
--     tasks.hedisGapCodes.
--   • pdf_data_url stores the small dataURL string produced by
--     generateClinicalNotePdf; larger notes should migrate to Supabase
--     Storage once row shape is stable (see plan §7 follow-ups).

CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id       text NOT NULL,
  hedis_member_id  text NOT NULL,
  gap_codes        text[] NOT NULL DEFAULT ARRAY[]::text[],

  form_type        text NOT NULL DEFAULT 'cbp_visit_note',
  status           text NOT NULL,

  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,

  pdf_filename     text,
  pdf_data_url     text,

  review_task_id   bigint REFERENCES public.tasks(id) ON DELETE SET NULL,

  author_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name      text,

  reviewer_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_name    text,

  signed_by_id     uuid,
  signed_by_name   text,
  signed_at        timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clinical_notes_status_check
    CHECK (status IN ('draft', 'submitted', 'signed'))
);

CREATE INDEX IF NOT EXISTS clinical_notes_patient_updated_idx
  ON public.clinical_notes (patient_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS clinical_notes_member_status_idx
  ON public.clinical_notes (hedis_member_id, status);

CREATE INDEX IF NOT EXISTS clinical_notes_review_task_idx
  ON public.clinical_notes (review_task_id)
  WHERE review_task_id IS NOT NULL;

-- updated_at bump on every UPDATE: mirrors the trigger pattern used on
-- tasks / caregap_activity so the P360 Notes tab's ORDER BY updated_at
-- doesn't lie after a re-save.
CREATE OR REPLACE FUNCTION public.clinical_notes_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clinical_notes_touch_updated_at ON public.clinical_notes;
CREATE TRIGGER clinical_notes_touch_updated_at
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.clinical_notes_touch_updated_at();

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read every note, matches the tasks posture and
-- keeps the P360 Notes tab and Care Gap Drawer Clinical Notes tab working
-- across staff. Anon is deliberately excluded (RLS_POSTURE.md).
DROP POLICY IF EXISTS "clinical_notes: authenticated read" ON public.clinical_notes;
CREATE POLICY "clinical_notes: authenticated read"
  ON public.clinical_notes
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes require an authenticated identity that matches either the
-- author (writing their own draft or signing their own note) or the
-- reviewer (reviewer flipping submitted → signed).
DROP POLICY IF EXISTS "clinical_notes: author or reviewer insert" ON public.clinical_notes;
CREATE POLICY "clinical_notes: author or reviewer insert"
  ON public.clinical_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    OR reviewer_id = auth.uid()
  );

DROP POLICY IF EXISTS "clinical_notes: author or reviewer update" ON public.clinical_notes;
CREATE POLICY "clinical_notes: author or reviewer update"
  ON public.clinical_notes
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR reviewer_id = auth.uid()
  )
  WITH CHECK (
    author_id = auth.uid()
    OR reviewer_id = auth.uid()
  );

-- DELETE is not exposed to app users, signed notes are permanent; a
-- staff-only cleanup path can be added later via a SECURITY DEFINER
-- function if needed.
