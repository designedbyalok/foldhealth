-- CMP (Care Management Program) worklist backing table.
-- One row per CMP enrollment (a member can be in several sub-programs: SPD,
-- Maternity Program, …); the store's fetchCmpMembers maps these
-- columns onto the worklist row. Dates are MM/DD/YYYY text, like the other
-- program worklists. RLS follows jsa_members: any signed-in staff member can
-- read the roster; writes need an active staff profile.
--
-- Seed: `bun run seed` (scripts/seed.js) upserts the rows from
-- src/features/cmp-worklist/data/mock.js.

CREATE TABLE IF NOT EXISTS public.cmp_members (
  id                  text PRIMARY KEY,
  patient_id          text,
  member_id           text,
  sub_program         text,
  name                text NOT NULL,
  initials            text,
  gender              text,
  age                 text,
  dob                 text,
  language            text DEFAULT 'en',
  program_sub_status  text,
  care_plan_status    text,
  next_action_due     text,
  program_start_date  text,
  program_due_date    text,
  outreach            integer DEFAULT 0,
  last_outreach       text,
  assignee            text,
  assignee_initials   text,
  risk_level          text,
  tasks               integer DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cmp_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cmp_members_select ON public.cmp_members;
CREATE POLICY cmp_members_select
  ON public.cmp_members FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS cmp_members_insert ON public.cmp_members;
CREATE POLICY cmp_members_insert
  ON public.cmp_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

DROP POLICY IF EXISTS cmp_members_update ON public.cmp_members;
CREATE POLICY cmp_members_update
  ON public.cmp_members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

DROP POLICY IF EXISTS cmp_members_delete ON public.cmp_members;
CREATE POLICY cmp_members_delete
  ON public.cmp_members FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.cmp_members;
