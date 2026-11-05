-- CMP worklist: the care team on each enrollment, beside its Assignee.
-- One column per role, the person's display name (null = nobody assigned
-- yet), per cmp_members row, so each sub-program has its own team.
-- Seed: `bun run seed` (scripts/seed.js) fills them from
-- src/features/cmp-worklist/data/mock.js.

ALTER TABLE public.cmp_members
  ADD COLUMN IF NOT EXISTS nurse_health_coach      text,
  ADD COLUMN IF NOT EXISTS coordinator             text,
  ADD COLUMN IF NOT EXISTS social_worker           text,
  ADD COLUMN IF NOT EXISTS community_health_worker text;
