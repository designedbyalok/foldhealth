-- DSF-B standalone rows: align `source` + `dueDateISO` with the app.
--
-- The five standalone DSF-B seeds (`ap-dsfb-01` … `ap-dsfb-05`) were
-- originally stamped with `source: "fold-native"` and no `dueDateISO`.
-- The app now:
--   • treats standalone DSF-B as an Astrana ingestion (DSF-A / PHQ-2
--     was completed outside Fold), so `source` should be `astrana`.
--   • anchors the 30-day sign-off window on the gap's own dueDateISO
--     (startDate + 30d) when no paired DSF-A `phq2.savedAt` exists.
--
-- This migration rewrites the single gap in each of those five members'
-- `gaps` array to carry the correct source label AND a `dueDateISO`
-- computed as startDate + 30d. Idempotent, running twice is a no-op.
--
-- Ask Alok Kumar to run this migration on Supabase.

DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT id, start_date FROM public.hedis_members
    WHERE id IN ('ap-dsfb-01', 'ap-dsfb-02', 'ap-dsfb-03', 'ap-dsfb-04', 'ap-dsfb-05')
  LOOP
    UPDATE public.hedis_members
    SET gaps = (
      SELECT jsonb_agg(
        CASE
          WHEN g->>'code' = 'DSF-B' THEN
            (g - 'source' - 'dueDateISO')
              || jsonb_build_object('source', 'astrana')
              || jsonb_build_object(
                'dueDateISO',
                to_char(
                  (to_date(target.start_date, 'MM/DD/YYYY') + INTERVAL '30 days')::timestamp AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                )
              )
          ELSE g
        END
      )
      FROM jsonb_array_elements(gaps) AS g
    )
    WHERE id = target.id;
  END LOOP;
END $$;
