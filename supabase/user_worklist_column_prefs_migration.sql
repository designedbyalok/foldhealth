-- Per-user, per-worklist column preferences.
-- Every worklist in the app (TOC Queue/Worklist, HCC, HEDIS, CCM, SNP,
-- AWV, JSA, Population Groups, All Patients, …) uses the shared
-- ColumnConfigPopover. The order + visibility a user picks in that
-- popover should follow them across devices, which requires a
-- server-side store; localStorage handles the offline / anonymous path.
--
-- One row per (user, worklist_key). column_order/hidden_cols are
-- string[] of column keys — order is authoritative (columns not listed
-- fall back to the default order), hidden_cols is the exclusion set.

CREATE TABLE IF NOT EXISTS public.user_worklist_column_prefs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worklist_key  text NOT NULL,
  column_order  jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_cols   jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_worklist_column_prefs_unique UNIQUE (user_id, worklist_key)
);

CREATE INDEX IF NOT EXISTS user_worklist_column_prefs_user_idx
  ON public.user_worklist_column_prefs (user_id);

-- Keep updated_at fresh so client caches can bail on stale rows.
CREATE OR REPLACE FUNCTION public.touch_user_worklist_column_prefs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_user_worklist_column_prefs
  ON public.user_worklist_column_prefs;

CREATE TRIGGER trg_touch_user_worklist_column_prefs
  BEFORE UPDATE ON public.user_worklist_column_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_worklist_column_prefs_updated_at();

ALTER TABLE public.user_worklist_column_prefs ENABLE ROW LEVEL SECURITY;

-- Every policy scopes to the authenticated caller's own rows only.
DROP POLICY IF EXISTS "read own column prefs"   ON public.user_worklist_column_prefs;
DROP POLICY IF EXISTS "insert own column prefs" ON public.user_worklist_column_prefs;
DROP POLICY IF EXISTS "update own column prefs" ON public.user_worklist_column_prefs;
DROP POLICY IF EXISTS "delete own column prefs" ON public.user_worklist_column_prefs;

CREATE POLICY "read own column prefs"
  ON public.user_worklist_column_prefs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert own column prefs"
  ON public.user_worklist_column_prefs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own column prefs"
  ON public.user_worklist_column_prefs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own column prefs"
  ON public.user_worklist_column_prefs
  FOR DELETE
  USING (auth.uid() = user_id);
