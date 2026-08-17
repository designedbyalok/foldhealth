-- Persist the table page-size preference per user.
--
-- Extends the existing public.user_worklist_prefs row (already keyed by
-- user_id and used for worklist_order) rather than adding a second
-- preferences table, so a user's table settings stay in one row.
--
--   auto_page_size — true (default) lets each table size its page to the
--                    viewport; false pins it to per_page.
--   per_page       — the size the user picked explicitly. Only meaningful
--                    when auto_page_size is false, but stored either way so
--                    toggling back to manual restores the last choice.
--
-- In deployed environments the table already exists with RLS enabled and an
-- authenticated-only "Allow all" policy (see
-- narrow_public_policies_to_authenticated.sql). Its CREATE was never checked
-- in, so guard it here to keep this runnable against a fresh database — on
-- an existing one every statement below is a no-op.
CREATE TABLE IF NOT EXISTS public.user_worklist_prefs (
  user_id        text PRIMARY KEY,
  worklist_order jsonb,
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE public.user_worklist_prefs ENABLE ROW LEVEL SECURITY;

-- Created only when absent — never redefined, so this can't widen the
-- existing production policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_worklist_prefs'
  ) THEN
    CREATE POLICY "Allow all"
      ON public.user_worklist_prefs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.user_worklist_prefs
  ADD COLUMN IF NOT EXISTS auto_page_size boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_worklist_prefs
  ADD COLUMN IF NOT EXISTS per_page integer NOT NULL DEFAULT 10;

-- Page sizes are quantised to multiples of 5 with a floor of 10 by the UI
-- (src/components/Pagination/useAutoPageSize.js). Mirror that here so a bad
-- write can't put a value on screen the selector could never produce.
ALTER TABLE public.user_worklist_prefs
  DROP CONSTRAINT IF EXISTS user_worklist_prefs_per_page_check;

ALTER TABLE public.user_worklist_prefs
  ADD CONSTRAINT user_worklist_prefs_per_page_check
  CHECK (per_page >= 10 AND per_page <= 100 AND per_page % 5 = 0);
