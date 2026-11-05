-- Feature review sign-off tracker.
--
-- Every feature that goes into the product gets a row in feature_reviews,
-- with a deep link (hash route) to the screen to review. A feature can have
-- sub-items (one level, via parent_id). Each feature or sub-item names one or
-- more reviewers in feature_review_signoffs; each reviewer signs off their own
-- row from the "Reviews" drawer in the nav bar and can leave a comment.
--
-- Enforced here, not only in the UI:
--   * only the managers in feature_review_managers can add or edit features
--     and assign, switch or remove reviewers;
--   * a reviewer sees only the items assigned to them (managers see all);
--   * only the assigned reviewer can sign their row; signed_at is stamped
--     with the server clock and can't be changed or cleared afterwards;
--   * a reviewer who has signed can't be removed from the item.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.feature_review_managers (
  email text PRIMARY KEY,
  name  text NOT NULL
);

INSERT INTO public.feature_review_managers (email, name) VALUES
  ('alokk@fold.health', 'Alok Kumar'),
  ('ketanp@fold.health', 'Ketan Patni'),
  ('devanshis@fold.health', 'Devanshi Sharma')
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.feature_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES public.feature_reviews (id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  area        text,
  link        text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_reviews_parent_idx ON public.feature_reviews (parent_id);

CREATE TABLE IF NOT EXISTS public.feature_review_signoffs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id     uuid NOT NULL REFERENCES public.feature_reviews (id) ON DELETE CASCADE,
  reviewer_email text NOT NULL,
  reviewer_name  text NOT NULL,
  assigned_by    text,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  signed_at      timestamptz,
  comment        text,
  commented_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_review_signoffs_reviewer_uniq
  ON public.feature_review_signoffs (feature_id, lower(reviewer_email));
CREATE INDEX IF NOT EXISTS feature_review_signoffs_email_idx
  ON public.feature_review_signoffs (lower(reviewer_email));

-- ── Helpers (SECURITY DEFINER so policies don't recurse through RLS) ──

CREATE OR REPLACE FUNCTION public.feature_review_jwt_email()
RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT lower(coalesce(auth.jwt() ->> 'email', '')) $$;

CREATE OR REPLACE FUNCTION public.feature_review_is_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.feature_review_managers m
    WHERE lower(m.email) = public.feature_review_jwt_email()
  )
$$;

-- An item is visible to a manager, to its reviewers, and (so a sub-item has
-- its parent for context) to the reviewers of any of its sub-items.
CREATE OR REPLACE FUNCTION public.feature_review_can_see(fid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.feature_review_is_manager() OR EXISTS (
    SELECT 1
    FROM public.feature_review_signoffs s
    JOIN public.feature_reviews f ON f.id = s.feature_id
    WHERE lower(s.reviewer_email) = public.feature_review_jwt_email()
      AND (f.id = fid OR f.parent_id = fid)
  )
$$;

-- ── Guards ──

-- Sub-items nest one level only.
CREATE OR REPLACE FUNCTION public.feature_reviews_one_level()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feature_reviews p WHERE p.id = NEW.parent_id AND p.parent_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Sub-items can''t have their own sub-items';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_reviews_one_level ON public.feature_reviews;
CREATE TRIGGER feature_reviews_one_level
  BEFORE INSERT OR UPDATE OF parent_id ON public.feature_reviews
  FOR EACH ROW EXECUTE FUNCTION public.feature_reviews_one_level();

-- A reviewer row starts unsigned and without a comment.
CREATE OR REPLACE FUNCTION public.feature_review_signoffs_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.reviewer_email := lower(NEW.reviewer_email);
  NEW.signed_at := NULL;
  NEW.comment := NULL;
  NEW.commented_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_review_signoffs_on_insert ON public.feature_review_signoffs;
CREATE TRIGGER feature_review_signoffs_on_insert
  BEFORE INSERT ON public.feature_review_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.feature_review_signoffs_on_insert();

-- Updates come only from the reviewer (RLS), and only to sign or comment.
CREATE OR REPLACE FUNCTION public.feature_review_signoffs_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.feature_id IS DISTINCT FROM OLD.feature_id
     OR NEW.reviewer_email IS DISTINCT FROM OLD.reviewer_email
     OR NEW.reviewer_name IS DISTINCT FROM OLD.reviewer_name
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
    RAISE EXCEPTION 'Change reviewers by removing and adding them';
  END IF;

  IF OLD.signed_at IS NOT NULL THEN
    NEW.signed_at := OLD.signed_at;
  ELSIF NEW.signed_at IS NOT NULL THEN
    NEW.signed_at := now();
  END IF;

  IF NEW.comment IS DISTINCT FROM OLD.comment THEN
    NEW.comment := nullif(btrim(NEW.comment), '');
    NEW.commented_at := CASE WHEN NEW.comment IS NULL THEN NULL ELSE now() END;
  ELSE
    NEW.commented_at := OLD.commented_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_review_signoffs_guard ON public.feature_review_signoffs;
CREATE TRIGGER feature_review_signoffs_guard
  BEFORE UPDATE ON public.feature_review_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.feature_review_signoffs_guard();

-- ── Row level security ──

ALTER TABLE public.feature_review_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_review_signoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_review_managers_select" ON public.feature_review_managers;
CREATE POLICY "feature_review_managers_select"
  ON public.feature_review_managers FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "feature_reviews_select" ON public.feature_reviews;
CREATE POLICY "feature_reviews_select"
  ON public.feature_reviews FOR SELECT TO authenticated
  USING (public.feature_review_can_see(id));

DROP POLICY IF EXISTS "feature_reviews_insert" ON public.feature_reviews;
CREATE POLICY "feature_reviews_insert"
  ON public.feature_reviews FOR INSERT TO authenticated
  WITH CHECK (public.feature_review_is_manager());

DROP POLICY IF EXISTS "feature_reviews_update" ON public.feature_reviews;
CREATE POLICY "feature_reviews_update"
  ON public.feature_reviews FOR UPDATE TO authenticated
  USING (public.feature_review_is_manager())
  WITH CHECK (public.feature_review_is_manager());

DROP POLICY IF EXISTS "feature_review_signoffs_select" ON public.feature_review_signoffs;
CREATE POLICY "feature_review_signoffs_select"
  ON public.feature_review_signoffs FOR SELECT TO authenticated
  USING (public.feature_review_can_see(feature_id));

DROP POLICY IF EXISTS "feature_review_signoffs_insert" ON public.feature_review_signoffs;
CREATE POLICY "feature_review_signoffs_insert"
  ON public.feature_review_signoffs FOR INSERT TO authenticated
  WITH CHECK (public.feature_review_is_manager());

DROP POLICY IF EXISTS "feature_review_signoffs_update" ON public.feature_review_signoffs;
CREATE POLICY "feature_review_signoffs_update"
  ON public.feature_review_signoffs FOR UPDATE TO authenticated
  USING (lower(reviewer_email) = public.feature_review_jwt_email())
  WITH CHECK (lower(reviewer_email) = public.feature_review_jwt_email());

DROP POLICY IF EXISTS "feature_review_signoffs_delete" ON public.feature_review_signoffs;
CREATE POLICY "feature_review_signoffs_delete"
  ON public.feature_review_signoffs FOR DELETE TO authenticated
  USING (public.feature_review_is_manager() AND signed_at IS NULL);

GRANT SELECT ON public.feature_review_managers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feature_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_review_signoffs TO authenticated;

NOTIFY pgrst, 'reload schema';
