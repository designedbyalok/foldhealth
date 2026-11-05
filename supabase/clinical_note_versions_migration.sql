-- Versioned audit for HEDIS Clinical Notes.
--
-- WHY: A signed note can be Amended, the author reopens the note, edits
-- fields, and re-saves. Up to now `upsertClinicalNote` overwrote the same
-- `clinical_notes` row, so the prior signed payload was lost and there was
-- no history to show "what was the state in each version" (requested for
-- the Preview's audit timeline). This migration adds an immutable snapshot
-- per mutation so every Draft → Submitted → Signed → Amended transition is
-- retained in the DB, not in local state.

CREATE TABLE IF NOT EXISTS public.clinical_note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  version int NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_filename text,
  pdf_data_url text,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_name text,
  signed_by_id uuid,
  signed_by_name text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, version)
);

CREATE INDEX IF NOT EXISTS clinical_note_versions_note_idx
  ON public.clinical_note_versions (note_id, version DESC);

CREATE INDEX IF NOT EXISTS clinical_note_versions_created_idx
  ON public.clinical_note_versions (created_at DESC);

-- Auto-version on every UPDATE to clinical_notes: snapshot the *old* row
-- into clinical_note_versions before it is overwritten. This guarantees
-- the audit is never skipped even if the caller forgets to write it,
-- and keeps the app code from needing a separate "create version" call.
CREATE OR REPLACE FUNCTION public.clinical_notes_version_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  next_version int;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.clinical_note_versions
  WHERE note_id = OLD.id;

  INSERT INTO public.clinical_note_versions (
    note_id, version, status, payload, pdf_filename, pdf_data_url,
    author_id, author_name, reviewer_id, reviewer_name,
    signed_by_id, signed_by_name, signed_at
  ) VALUES (
    OLD.id, next_version, OLD.status, OLD.payload, OLD.pdf_filename, OLD.pdf_data_url,
    OLD.author_id, OLD.author_name, OLD.reviewer_id, OLD.reviewer_name,
    OLD.signed_by_id, OLD.signed_by_name, OLD.signed_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinical_notes_version_trigger ON public.clinical_notes;
CREATE TRIGGER clinical_notes_version_trigger
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.clinical_notes_version_snapshot();

ALTER TABLE public.clinical_note_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical_note_versions: authenticated read" ON public.clinical_note_versions;
CREATE POLICY "clinical_note_versions: authenticated read"
  ON public.clinical_note_versions
  FOR SELECT
  TO authenticated
  using ((select auth.uid()) is not null);

-- Writes are trigger-driven (no direct INSERT from client needed), but
-- allow service_role / authenticated insert for backfill or manual amend
-- flows that explicitly create a version before first update.
DROP POLICY IF EXISTS "clinical_note_versions: authenticated insert" ON public.clinical_note_versions;
CREATE POLICY "clinical_note_versions: authenticated insert"
  ON public.clinical_note_versions
  FOR INSERT
  TO authenticated
  with check ((select auth.uid()) is not null);
