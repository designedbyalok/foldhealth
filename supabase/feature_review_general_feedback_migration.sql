-- Design Signoff: general feedback, not tied to a Signoff item.
--
-- "Start a review" in the Signoff drawer opens the review box on any page
-- without picking an item. That feedback is stored with feature_id NULL and
-- the page it was made on (in points[].context and context). Its author and
-- the Signoff managers (feature_review_managers) can read it; item feedback
-- keeps following the item, as before. Files for it live in the
-- `review-attachments` bucket under general/<comment_id>/<file>.
--
-- Requires feature_review_comments_migration.sql. Safe to run more than once.

ALTER TABLE public.feature_review_comments
  ALTER COLUMN feature_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS feature_review_comments_general_idx
  ON public.feature_review_comments (created_at DESC)
  WHERE feature_id IS NULL;

DROP POLICY IF EXISTS "feature_review_comments_select" ON public.feature_review_comments;
CREATE POLICY "feature_review_comments_select"
  ON public.feature_review_comments FOR SELECT TO authenticated
  USING (
    CASE WHEN feature_id IS NULL
      THEN lower(author_email) = public.feature_review_jwt_email() OR public.feature_review_is_manager()
      ELSE public.feature_review_can_see(feature_id)
    END
  );

-- Anyone signed in can leave general feedback; the author is stamped from
-- the JWT by the existing trigger.
DROP POLICY IF EXISTS "feature_review_comments_insert" ON public.feature_review_comments;
CREATE POLICY "feature_review_comments_insert"
  ON public.feature_review_comments FOR INSERT TO authenticated
  WITH CHECK (feature_id IS NULL OR public.feature_review_can_see(feature_id));

-- ── Attachments ──

DROP POLICY IF EXISTS "review-attachments upload" ON storage.objects;
CREATE POLICY "review-attachments upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'review-attachments'
    AND (split_part(name, '/', 1) = 'general' OR public.feature_review_can_see_path(name))
  );

DROP POLICY IF EXISTS "review-attachments read" ON storage.objects;
CREATE POLICY "review-attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'review-attachments'
    AND CASE WHEN split_part(name, '/', 1) = 'general'
      THEN owner_id = auth.uid()::text OR public.feature_review_is_manager()
      ELSE public.feature_review_can_see_path(name)
    END
  );

NOTIFY pgrst, 'reload schema';

-- ── Rollback ──
-- DELETE FROM public.feature_review_comments WHERE feature_id IS NULL;
-- ALTER TABLE public.feature_review_comments ALTER COLUMN feature_id SET NOT NULL;
-- DROP INDEX IF EXISTS public.feature_review_comments_general_idx;
-- Then re-run the policy section of feature_review_comments_migration.sql.
