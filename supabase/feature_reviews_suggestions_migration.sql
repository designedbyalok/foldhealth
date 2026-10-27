-- Feature review suggestions from the changelog.
--
-- The changelog GitHub Action inserts a changelog_entries row for every
-- user-facing commit on main (feat → New, fix → Fixed, perf/refactor/style →
-- Improved). This adds a trigger that turns each New or Fixed entry into a
-- *suggested* feature review item, so the review list fills itself as we
-- build. The design team (feature_review_managers) then keeps a suggestion
-- for review, which needs at least one reviewer, or removes it.
--
-- Visibility: managers see everything; everyone else sees only approved
-- items assigned to them (plus the parent of an approved sub-item assigned
-- to them). A reviewer can only sign off an approved item.
--
-- Requires supabase/feature_reviews_migration.sql. Safe to run more than once.

ALTER TABLE public.feature_reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.feature_reviews ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'feature';
ALTER TABLE public.feature_reviews ADD COLUMN IF NOT EXISTS changelog_entry_id uuid
  REFERENCES public.changelog_entries (id) ON DELETE SET NULL;
ALTER TABLE public.feature_reviews ADD COLUMN IF NOT EXISTS decided_by text;
ALTER TABLE public.feature_reviews ADD COLUMN IF NOT EXISTS decided_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_reviews_status_check') THEN
    ALTER TABLE public.feature_reviews ADD CONSTRAINT feature_reviews_status_check
      CHECK (status IN ('suggested', 'approved', 'dismissed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_reviews_kind_check') THEN
    ALTER TABLE public.feature_reviews ADD CONSTRAINT feature_reviews_kind_check
      CHECK (kind IN ('feature', 'fix'));
  END IF;
END $$;

-- One suggestion per changelog entry, so a removed one never comes back.
CREATE UNIQUE INDEX IF NOT EXISTS feature_reviews_changelog_entry_uniq
  ON public.feature_reviews (changelog_entry_id) WHERE changelog_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS feature_reviews_status_idx ON public.feature_reviews (status, created_at DESC);

-- ── Changelog → suggestion ──

CREATE OR REPLACE FUNCTION public.feature_reviews_suggest_from_changelog()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.kind IN ('New', 'Fixed') THEN
    INSERT INTO public.feature_reviews (title, kind, status, changelog_entry_id, created_by, created_at)
    VALUES (NEW.title, CASE WHEN NEW.kind = 'Fixed' THEN 'fix' ELSE 'feature' END,
            'suggested', NEW.id, 'Changelog', NEW.created_at)
    ON CONFLICT (changelog_entry_id) WHERE changelog_entry_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_reviews_suggest_from_changelog ON public.changelog_entries;
CREATE TRIGGER feature_reviews_suggest_from_changelog
  AFTER INSERT ON public.changelog_entries
  FOR EACH ROW EXECUTE FUNCTION public.feature_reviews_suggest_from_changelog();

-- Backfill this month's features and fixes as suggestions.
INSERT INTO public.feature_reviews (title, kind, status, changelog_entry_id, created_by, created_at)
SELECT c.title, CASE WHEN c.kind = 'Fixed' THEN 'fix' ELSE 'feature' END,
       'suggested', c.id, 'Changelog', c.created_at
FROM public.changelog_entries c
WHERE c.kind IN ('New', 'Fixed') AND c.created_at >= '2026-10-01'
ON CONFLICT (changelog_entry_id) WHERE changelog_entry_id IS NOT NULL DO NOTHING;

-- ── Guards ──

-- Keeping a suggestion needs a reviewer, and stamps who decided and when.
CREATE OR REPLACE FUNCTION public.feature_reviews_status_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' AND NOT EXISTS (
      SELECT 1 FROM public.feature_review_signoffs s WHERE s.feature_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Assign at least one reviewer before keeping this for review';
    END IF;
    NEW.decided_by := coalesce(
      (SELECT m.name FROM public.feature_review_managers m WHERE lower(m.email) = public.feature_review_jwt_email()),
      NEW.decided_by);
    NEW.decided_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_reviews_status_guard ON public.feature_reviews;
CREATE TRIGGER feature_reviews_status_guard
  BEFORE UPDATE OF status ON public.feature_reviews
  FOR EACH ROW EXECUTE FUNCTION public.feature_reviews_status_guard();

-- ── Visibility ──

CREATE OR REPLACE FUNCTION public.feature_review_can_see(fid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.feature_review_is_manager() OR EXISTS (
    SELECT 1
    FROM public.feature_review_signoffs s
    JOIN public.feature_reviews f ON f.id = s.feature_id
    WHERE lower(s.reviewer_email) = public.feature_review_jwt_email()
      AND f.status = 'approved'
      AND (f.id = fid OR f.parent_id = fid)
  )
$$;

CREATE OR REPLACE FUNCTION public.feature_review_is_approved(fid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.feature_reviews f WHERE f.id = fid AND f.status = 'approved') $$;

DROP POLICY IF EXISTS "feature_review_signoffs_update" ON public.feature_review_signoffs;
CREATE POLICY "feature_review_signoffs_update"
  ON public.feature_review_signoffs FOR UPDATE TO authenticated
  USING (lower(reviewer_email) = public.feature_review_jwt_email() AND public.feature_review_is_approved(feature_id))
  WITH CHECK (lower(reviewer_email) = public.feature_review_jwt_email());

NOTIFY pgrst, 'reload schema';
