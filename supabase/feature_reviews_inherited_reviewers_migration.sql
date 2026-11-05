-- Feature review: a feature's reviewers also review its sub-items, and
-- signing off every sub-item signs off the feature.
--
-- * A reviewer assigned to a top-level feature gets an inherited reviewer row
--   on each of its sub-items (inherited_from = the feature). The row is a
--   normal sign-off row, so the existing RLS and guards apply unchanged.
-- * Kept in step with the tree: assigning or removing a feature reviewer,
--   adding a sub-item, and nesting, un-nesting or moving a sub-item. An
--   inherited row that's already signed is kept (it becomes a direct row)
--   rather than losing the sign-off.
-- * When a reviewer signs their last sub-item under a feature, their own row
--   on that feature is signed too.
--
-- Requires the earlier feature_reviews migrations. Safe to run more than once.

-- No foreign key on inherited_from: a second relationship to feature_reviews
-- makes the app's PostgREST embed ambiguous (see
-- feature_reviews_drop_inherited_fk_migration.sql).
ALTER TABLE public.feature_review_signoffs
  ADD COLUMN IF NOT EXISTS inherited_from uuid;

CREATE INDEX IF NOT EXISTS feature_review_signoffs_inherited_idx
  ON public.feature_review_signoffs (inherited_from) WHERE inherited_from IS NOT NULL;

-- ── Helpers ──

-- Give every sub-item of `parent` an inherited row for `email`.
CREATE OR REPLACE FUNCTION public.feature_review_inherit_to_children(parent uuid, email text, name text, by_name text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.feature_review_signoffs (feature_id, reviewer_email, reviewer_name, assigned_by, inherited_from)
  SELECT c.id, lower(email), name, by_name, parent
  FROM public.feature_reviews c
  WHERE c.parent_id = parent
  ON CONFLICT (feature_id, lower(reviewer_email)) DO NOTHING;
$$;

-- Give one sub-item an inherited row for each of its parent's reviewers.
CREATE OR REPLACE FUNCTION public.feature_review_inherit_from_parent(child uuid, parent uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.feature_review_signoffs (feature_id, reviewer_email, reviewer_name, assigned_by, inherited_from)
  SELECT child, s.reviewer_email, s.reviewer_name, s.assigned_by, parent
  FROM public.feature_review_signoffs s
  WHERE s.feature_id = parent AND s.inherited_from IS NULL
  ON CONFLICT (feature_id, lower(reviewer_email)) DO NOTHING;
$$;

-- Drop a sub-item's unsigned rows inherited from `parent`; keep signed ones
-- as direct rows so the sign-off isn't lost.
CREATE OR REPLACE FUNCTION public.feature_review_drop_inherited(child uuid, parent uuid, email text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.feature_review_signoffs
  WHERE feature_id = child AND inherited_from = parent AND signed_at IS NULL
    AND (email IS NULL OR lower(reviewer_email) = lower(email));
  UPDATE public.feature_review_signoffs SET inherited_from = NULL
  WHERE feature_id = child AND inherited_from = parent
    AND (email IS NULL OR lower(reviewer_email) = lower(email));
END;
$$;

-- ── Reviewer assigned to / removed from a feature ──

CREATE OR REPLACE FUNCTION public.feature_review_signoffs_propagate()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_parent boolean;
  kid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.inherited_from IS NULL THEN
      SELECT f.parent_id IS NULL INTO is_parent FROM public.feature_reviews f WHERE f.id = NEW.feature_id;
      IF is_parent THEN
        PERFORM public.feature_review_inherit_to_children(NEW.feature_id, NEW.reviewer_email, NEW.reviewer_name, NEW.assigned_by);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE of a direct row on a feature: take it off the sub-items too.
  IF OLD.inherited_from IS NULL THEN
    FOR kid IN SELECT c.id FROM public.feature_reviews c WHERE c.parent_id = OLD.feature_id LOOP
      PERFORM public.feature_review_drop_inherited(kid, OLD.feature_id, OLD.reviewer_email);
    END LOOP;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS feature_review_signoffs_propagate ON public.feature_review_signoffs;
CREATE TRIGGER feature_review_signoffs_propagate
  AFTER INSERT OR DELETE ON public.feature_review_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.feature_review_signoffs_propagate();

-- The insert guard clears signed_at/comment but must keep inherited_from.
-- (It already only touches those columns; nothing to change.)

-- ── Sub-item added, nested, un-nested or moved ──

CREATE OR REPLACE FUNCTION public.feature_reviews_sync_inherited()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.parent_id IS NOT NULL AND OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
    PERFORM public.feature_review_drop_inherited(NEW.id, OLD.parent_id);
  END IF;
  IF NEW.parent_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN
    PERFORM public.feature_review_inherit_from_parent(NEW.id, NEW.parent_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_reviews_sync_inherited ON public.feature_reviews;
CREATE TRIGGER feature_reviews_sync_inherited
  AFTER INSERT OR UPDATE OF parent_id ON public.feature_reviews
  FOR EACH ROW EXECUTE FUNCTION public.feature_reviews_sync_inherited();

-- ── Last sub-item signed → the feature is signed for that reviewer ──

CREATE OR REPLACE FUNCTION public.feature_review_signoffs_roll_up()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  parent uuid;
BEGIN
  IF OLD.signed_at IS NOT NULL OR NEW.signed_at IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT f.parent_id INTO parent FROM public.feature_reviews f WHERE f.id = NEW.feature_id;
  IF parent IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.feature_review_signoffs s
    JOIN public.feature_reviews c ON c.id = s.feature_id
    WHERE c.parent_id = parent
      AND lower(s.reviewer_email) = lower(NEW.reviewer_email)
      AND s.signed_at IS NULL
  ) THEN
    UPDATE public.feature_review_signoffs
    SET signed_at = now()
    WHERE feature_id = parent
      AND lower(reviewer_email) = lower(NEW.reviewer_email)
      AND signed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_review_signoffs_roll_up ON public.feature_review_signoffs;
CREATE TRIGGER feature_review_signoffs_roll_up
  AFTER UPDATE OF signed_at ON public.feature_review_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.feature_review_signoffs_roll_up();

-- ── Backfill: existing feature reviewers onto existing sub-items ──

INSERT INTO public.feature_review_signoffs (feature_id, reviewer_email, reviewer_name, assigned_by, inherited_from)
SELECT c.id, s.reviewer_email, s.reviewer_name, s.assigned_by, c.parent_id
FROM public.feature_reviews c
JOIN public.feature_review_signoffs s ON s.feature_id = c.parent_id AND s.inherited_from IS NULL
WHERE c.parent_id IS NOT NULL
ON CONFLICT (feature_id, lower(reviewer_email)) DO NOTHING;

NOTIFY pgrst, 'reload schema';
