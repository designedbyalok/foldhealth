-- Clinical protocols: a client's clinical practice guidance (PDF, Word or
-- structured JSON) stored as a first-class object. Settings > Clinical
-- Protocols uploads the file, the parser (api/_handlers/clinical-protocol-parse.js)
-- extracts the protocol (condition scope, thresholds, decision rules, cadence,
-- medication titration, cross-references) and a supervisor reviews it.
--
--   status       processing → draft (parsed, awaiting review) → active
--                (approved) → superseded (a newer version was approved) or
--                retired; failed when the file couldn't be parsed.
--   protocol     the structured protocol, Fold protocol schema v1
--                (src/features/settings/clinical-protocols/lib/protocolSchema.js).
--                Every extracted item carries the source passage it came from.
--   source_text  the text extracted from the file, kept for re-parsing and
--                for showing an item's passage in context.
--   source_path  the original file in the private `clinical-protocols` bucket.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.clinical_protocols (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  organization    text,
  condition_tags  text[] NOT NULL DEFAULT '{}',
  program_codes   text[] NOT NULL DEFAULT '{}',
  effective_date  date,
  review_date     date,
  author          text,
  version         text,
  status          text NOT NULL DEFAULT 'draft',
  source_kind     text,
  source_name     text,
  source_path     text,
  source_size     integer,
  source_text     text,
  protocol        jsonb NOT NULL DEFAULT '{}'::jsonb,
  parse_meta      jsonb NOT NULL DEFAULT '{}'::jsonb,
  parse_error     text,
  supersedes_id   uuid REFERENCES public.clinical_protocols(id) ON DELETE SET NULL,
  uploaded_by     text,
  approved_by     text,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinical_protocols_status_check') THEN
    ALTER TABLE public.clinical_protocols ADD CONSTRAINT clinical_protocols_status_check
      CHECK (status IN ('processing', 'draft', 'active', 'superseded', 'retired', 'failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinical_protocols_source_kind_check') THEN
    ALTER TABLE public.clinical_protocols ADD CONSTRAINT clinical_protocols_source_kind_check
      CHECK (source_kind IS NULL OR source_kind IN ('pdf', 'docx', 'json'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinical_protocols_dates_check') THEN
    ALTER TABLE public.clinical_protocols ADD CONSTRAINT clinical_protocols_dates_check
      CHECK (review_date IS NULL OR effective_date IS NULL OR review_date >= effective_date);
  END IF;
END $$;

-- The library filters on status, conditions and programs.
CREATE INDEX IF NOT EXISTS clinical_protocols_status_idx ON public.clinical_protocols (status);
CREATE INDEX IF NOT EXISTS clinical_protocols_conditions_idx ON public.clinical_protocols USING gin (condition_tags);
CREATE INDEX IF NOT EXISTS clinical_protocols_programs_idx ON public.clinical_protocols USING gin (program_codes);
CREATE INDEX IF NOT EXISTS clinical_protocols_supersedes_idx ON public.clinical_protocols (supersedes_id);

ALTER TABLE public.clinical_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read clinical protocols"   ON public.clinical_protocols;
DROP POLICY IF EXISTS "insert clinical protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "update clinical protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "delete clinical protocols" ON public.clinical_protocols;

CREATE POLICY "read clinical protocols" ON public.clinical_protocols
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert clinical protocols" ON public.clinical_protocols
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update clinical protocols" ON public.clinical_protocols
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete clinical protocols" ON public.clinical_protocols
  FOR DELETE TO authenticated USING (true);

-- Private bucket for the original files (client guidance isn't public);
-- the app reads them through signed URLs. 25 MB per file.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('clinical-protocols', 'clinical-protocols', false, 26214400)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "clinical-protocols upload" ON storage.objects;
CREATE POLICY "clinical-protocols upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinical-protocols');

DROP POLICY IF EXISTS "clinical-protocols read" ON storage.objects;
CREATE POLICY "clinical-protocols read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'clinical-protocols');

DROP POLICY IF EXISTS "clinical-protocols delete" ON storage.objects;
CREATE POLICY "clinical-protocols delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clinical-protocols');

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.clinical_protocols;
-- DROP POLICY IF EXISTS "clinical-protocols upload" ON storage.objects;
-- DROP POLICY IF EXISTS "clinical-protocols read" ON storage.objects;
-- DROP POLICY IF EXISTS "clinical-protocols delete" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'clinical-protocols';
