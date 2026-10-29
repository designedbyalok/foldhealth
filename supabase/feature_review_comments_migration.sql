-- Design Signoff: in-place review comments with attachments.
--
-- "Review" on an item opens its section with a floating comment box
-- (packages/review-kit). One piece of feedback is a series of points, so a
-- review can walk through a long flow screen by screen: each point has its own
-- rich-text comment, its own screenshots (element picks, screen shots, uploaded
-- images or GIFs) and the page it was made on. Feedback lives here, one row per
-- send; files live in the private `review-attachments` bucket under
-- <feature_id>/<comment_id>/<file>.
--
-- Access follows the item: anyone who can see an item (its reviewers and the
-- managers, via feature_review_can_see) can read and add its comments and
-- files. Authors are stamped from the JWT; a comment can only be deleted by its
-- author. The staff_only gate is added to the new table by the
-- add_staff_only_policy event trigger.
--
-- Requires the earlier feature_reviews migrations. Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.feature_review_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id   uuid NOT NULL REFERENCES public.feature_reviews (id) ON DELETE CASCADE,
  author_email text NOT NULL,
  author_name  text,
  -- Plain text of all points, for previews and search.
  body         text NOT NULL DEFAULT '',
  -- [{ text, html (sanitize before rendering),
  --    attachments: [{ path, name, type, size, kind: 'element'|'screen'|'upload',
  --                    selector?, element?, rect? }],
  --    context: { url, title, viewport } }]
  points       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- { url, title, viewport, userAgent, createdAt } when the feedback was sent
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feature_review_comments_has_points
    CHECK (jsonb_typeof(points) = 'array' AND jsonb_array_length(points) > 0)
);

CREATE INDEX IF NOT EXISTS feature_review_comments_feature_idx
  ON public.feature_review_comments (feature_id, created_at DESC);

-- The author is whoever is signed in, never what the client claims.
CREATE OR REPLACE FUNCTION public.feature_review_comments_stamp_author()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.author_email := public.feature_review_jwt_email();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_review_comments_stamp_author ON public.feature_review_comments;
CREATE TRIGGER feature_review_comments_stamp_author
  BEFORE INSERT ON public.feature_review_comments
  FOR EACH ROW EXECUTE FUNCTION public.feature_review_comments_stamp_author();

ALTER TABLE public.feature_review_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_review_comments_select" ON public.feature_review_comments;
CREATE POLICY "feature_review_comments_select"
  ON public.feature_review_comments FOR SELECT TO authenticated
  USING (public.feature_review_can_see(feature_id));

DROP POLICY IF EXISTS "feature_review_comments_insert" ON public.feature_review_comments;
CREATE POLICY "feature_review_comments_insert"
  ON public.feature_review_comments FOR INSERT TO authenticated
  WITH CHECK (public.feature_review_can_see(feature_id));

DROP POLICY IF EXISTS "feature_review_comments_delete" ON public.feature_review_comments;
CREATE POLICY "feature_review_comments_delete"
  ON public.feature_review_comments FOR DELETE TO authenticated
  USING (lower(author_email) = public.feature_review_jwt_email());

GRANT SELECT, INSERT, DELETE ON public.feature_review_comments TO authenticated;

-- ── Attachments bucket ──

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-attachments', 'review-attachments', false, 10485760,
        ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Files sit under <feature_id>/…; visible to whoever can see that item.
CREATE OR REPLACE FUNCTION public.feature_review_can_see_path(object_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.feature_review_can_see(split_part(object_name, '/', 1)::uuid)
    ELSE false
  END
$$;

DROP POLICY IF EXISTS "review-attachments upload" ON storage.objects;
CREATE POLICY "review-attachments upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'review-attachments' AND public.feature_review_can_see_path(name));

DROP POLICY IF EXISTS "review-attachments read" ON storage.objects;
CREATE POLICY "review-attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'review-attachments' AND public.feature_review_can_see_path(name));

DROP POLICY IF EXISTS "review-attachments delete" ON storage.objects;
CREATE POLICY "review-attachments delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'review-attachments' AND owner_id = auth.uid()::text);

NOTIFY pgrst, 'reload schema';

-- ── Rollback ──
-- DROP POLICY IF EXISTS "review-attachments upload" ON storage.objects;
-- DROP POLICY IF EXISTS "review-attachments read" ON storage.objects;
-- DROP POLICY IF EXISTS "review-attachments delete" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'review-attachments';
-- DROP TABLE IF EXISTS public.feature_review_comments;
-- DROP FUNCTION IF EXISTS public.feature_review_can_see_path(text);
-- DROP FUNCTION IF EXISTS public.feature_review_comments_stamp_author();
