-- Feature review nesting guard, for drag-to-nest in the Design Signoff drawer.
--
-- Items nest one level deep. The original guard only refused a parent that is
-- itself a sub-item; moving a feature that has sub-items under another feature
-- would still have made two levels. This also refuses nesting an item under
-- itself.
--
-- Requires supabase/feature_reviews_migration.sql. Safe to run more than once.

CREATE OR REPLACE FUNCTION public.feature_reviews_one_level()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'An item can''t be nested under itself';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.feature_reviews p WHERE p.id = NEW.parent_id AND p.parent_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Sub-items can''t have their own sub-items';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.feature_reviews c WHERE c.parent_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Move this item''s sub-items out before nesting it';
  END IF;
  RETURN NEW;
END;
$$;
