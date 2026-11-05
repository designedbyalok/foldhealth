-- Scrub orphaned Fold-native DSF-B gap rows.
--
-- A DSF-B gap should only be openable when the paired DSF-A note has
-- been saved with a Positive PHQ-2 (which flips DSF-A into Ready-for-
-- Review inside the note flow). Earlier test sessions produced a
-- state where a runtime-created DSF-B row was submitted on its own
-- while the paired DSF-A stayed `Open`, leaving inconsistent rows on
-- the worklist like `DSF-A: Open` + `DSF-B: Submitted`.
--
-- This migration removes every `source: fold-native` DSF-B gap on a
-- member whose paired DSF-A isn't `Completed`. Standalone DSF-B rows
-- from Astrana (`source: astrana`) are untouched: those are
-- ingestions the seed sets up on purpose.
--
-- Idempotent: a re-run finds no matching rows and is a no-op.
--
-- Ask Alok Kumar to run this migration on Supabase.

DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT id, gaps FROM public.hedis_members
    WHERE gaps @> '[{"code":"DSF-B","source":"fold-native"}]'::jsonb
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(gaps) AS g
        WHERE g->>'code' = 'DSF-A'
          AND (g->>'status') IS DISTINCT FROM 'Completed'
      )
  LOOP
    UPDATE public.hedis_members
    SET gaps = (
      SELECT COALESCE(jsonb_agg(g), '[]'::jsonb)
      FROM jsonb_array_elements(target.gaps) AS g
      WHERE NOT (g->>'code' = 'DSF-B' AND g->>'source' = 'fold-native')
    )
    WHERE id = target.id;
  END LOOP;
END $$;
