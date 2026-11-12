-- Live call scripts (care management redesign prototype, Call view): what the
-- full-screen live call overlay shows for a patient on a call. One row per
-- patient, keyed by Fold ID (member_id).
--
-- There's no speech-to-text in the app yet, so after the patient agrees to
-- recording the overlay plays `lines` one at a time. Each line may carry a
-- highlight (`hl`, a substring of `text`) and the action item it raised
-- (`item`, an id in `items`). `points` are talking points, covered once their
-- `line` has been shown. `{cm}` / `{cmFirst}` in text stand for the care
-- manager on the call. Same shape as src/features/live-call/data/scripts.js,
-- which the app falls back to until the table is seeded.
--
-- RLS follows my_patients_worklist: signed-in staff read; writes need an
-- active staff profile. Seed: supabase/live_call_scripts_seed.sql (Dev).
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.live_call_scripts (
  member_id    text PRIMARY KEY,
  reason       text NOT NULL,
  interpreter  text NOT NULL DEFAULT 'English',
  speakers     jsonb NOT NULL DEFAULT '{}'::jsonb,
  lines        jsonb NOT NULL DEFAULT '[]'::jsonb,
  points       jsonb NOT NULL DEFAULT '[]'::jsonb,
  meds         jsonb NOT NULL DEFAULT '[]'::jsonb,
  items        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_call_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_call_scripts_select ON public.live_call_scripts;
CREATE POLICY live_call_scripts_select
  ON public.live_call_scripts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS live_call_scripts_write ON public.live_call_scripts;
CREATE POLICY live_call_scripts_write
  ON public.live_call_scripts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'));

-- ── Rollback ──────────────────────────────────────────────────────────────
--   drop table if exists public.live_call_scripts;
