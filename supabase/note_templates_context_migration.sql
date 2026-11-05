-- Note Templates Context Migration
--
-- Adds the Visit vs Non-Visit dimension to note templates, and reshapes
-- the "one default per care gap" rule to enforce one default per
-- (gap_code, context) pair instead. Prior migration
-- (supabase/note_templates_migration.sql) established `forms.gap_code`
-- and `forms.is_default_for_gap` for the visit-only case; this migration
-- generalizes both.
--
-- Idempotent: safe to re-run.

BEGIN;

-- 1. Add `context` column. Null = "Normal Note" (not associated with a
--    care gap or Visit/Non-Visit split). Values allowed are 'visit' and
--    'non_visit'. Constraint is added defensively; the column itself is
--    added IF NOT EXISTS so re-runs are harmless.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'forms'
       AND column_name = 'context'
  ) THEN
    ALTER TABLE public.forms
      ADD COLUMN context text
        CHECK (context IS NULL OR context IN ('visit', 'non_visit'));
  END IF;
END $$;

-- 2. Backfill existing rows: every note template that was authored under
--    the old shape (`form_type='Note'` AND `gap_code IS NOT NULL`) was
--    implicitly a Visit template. Stamp them accordingly. Rows that
--    already have a context (a re-run) are left untouched.
UPDATE public.forms
   SET context = 'visit'
 WHERE form_type = 'Note'
   AND gap_code IS NOT NULL
   AND context IS NULL;

-- 3. Replace the single-default index with a (gap_code, context) index.
--    The old index enforced "at most one Visit default per gap" (before
--    context existed, this was the only default kind). The new index
--    supports the two-lane rule: at most one Visit default AND at most
--    one Non-Visit default per gap.
DROP INDEX IF EXISTS public.forms_gap_code_default_idx;

CREATE UNIQUE INDEX IF NOT EXISTS forms_gap_code_context_default_idx
  ON public.forms (gap_code, context)
  WHERE is_default_for_gap = true
    AND gap_code IS NOT NULL
    AND context IS NOT NULL;

-- 4. Helper index for look-ups by (gap_code, context), used by the
--    fetchNoteTemplates store action and the Add-Note flow when picking
--    a default template.
CREATE INDEX IF NOT EXISTS forms_gap_code_context_idx
  ON public.forms (gap_code, context)
  WHERE gap_code IS NOT NULL;

COMMIT;

-- Notes for the reviewer:
--
-- - `status` column already exists on `forms` with default 'draft'. The
--   Settings UI reuses it for archive: 'draft' | 'active' | 'archived'.
--   No column change needed here; only the UI filter changes.
--
-- - Historical `clinical_notes.payload` values are answer snapshots, not
--   schema snapshots. Editing a template's schema affects future renders
--   only. See `supabase/clinical_notes_migration.sql` for the payload
--   column and `supabase/clinical_notes_lifecycle_guards_migration.sql`
--   for the version snapshot trigger.
