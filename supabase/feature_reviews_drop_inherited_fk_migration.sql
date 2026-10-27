-- Fix: the Design Signoff list stopped loading after
-- feature_reviews_inherited_reviewers_migration.sql.
--
-- That migration added a second foreign key from feature_review_signoffs to
-- feature_reviews (inherited_from). The app loads items with their reviewers
-- in one PostgREST request (feature_reviews?select=...,feature_review_signoffs(...)),
-- and with two relationships PostgREST refuses to pick one:
--   "Could not embed because more than one relationship was found"
--
-- The inherited_from foreign key isn't needed: the inherit/drop triggers keep
-- inherited rows in step, and deleting a feature already cascades to its
-- sub-items and their reviewer rows through feature_id. So drop it; the
-- column stays.
--
-- Safe to run more than once.

ALTER TABLE public.feature_review_signoffs
  DROP CONSTRAINT IF EXISTS feature_review_signoffs_inherited_from_fkey;

NOTIFY pgrst, 'reload schema';
