-- CMP worklist: Last Admission, Case Acuity, Risk Level and Tags, before
-- Tasks. Per cmp_members row, the same on every enrollment of a member.
-- `risk_tier` is the plan's tier ("4_Low Risk", "1_High Risk"); the existing
-- `risk_level` (Low / Medium / High) still backs Risk IQ.
-- Seed: `bun run seed` (scripts/seed.js) fills them from
-- src/features/cmp-worklist/data/mock.js.

ALTER TABLE public.cmp_members
  ADD COLUMN IF NOT EXISTS last_admission text,
  ADD COLUMN IF NOT EXISTS case_acuity    text,
  ADD COLUMN IF NOT EXISTS risk_tier      text,
  ADD COLUMN IF NOT EXISTS tags           text[] NOT NULL DEFAULT '{}';
