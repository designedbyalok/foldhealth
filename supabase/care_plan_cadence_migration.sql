-- Care plan review cadence (#131, CCP > Care Plan > Follow-up).
--
-- How often a patient's care plan is reviewed:
--
--   care_program_types.cadence   per program type (Settings > Care Program
--     Configuration > Cadence):
--     { every, unit: 'day'|'week'|'month',
--       byAcuity: { High?: {every, unit}, Medium?: …, Low?: … },
--       overdueAfterDays,
--       postDischarge: { enabled, every, unit, days } }
--     An empty object reads as the program's built-in default
--     (HICM weekly, CCM monthly, SNP quarterly; see care-plan/lib/cadence.js).
--
--   patient_care_programs.cadence_override   per enrollment, set from the
--     patient's care plan: { every, unit, reason, setBy, setAt } or null.
--
-- The cadence in force, the next review date and the overdue flag are worked
-- out in the app from these, the enrollment's acuity, the last finished
-- care_plan_call_reviews row and ADT discharge events, so nothing else is
-- stored and the post-discharge spike ends on its own.
--
-- Additive and idempotent. No new table, so RLS is unchanged.

ALTER TABLE public.care_program_types
  ADD COLUMN IF NOT EXISTS cadence jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.patient_care_programs
  ADD COLUMN IF NOT EXISTS cadence_override jsonb;

-- Built-in defaults for programs that have no cadence saved yet.
UPDATE public.care_program_types SET cadence =
  '{"every":1,"unit":"week","byAcuity":{},"overdueAfterDays":2,"postDischarge":{"enabled":true,"every":1,"unit":"week","days":30}}'::jsonb
  WHERE code = 'HICM' AND cadence = '{}'::jsonb;

UPDATE public.care_program_types SET cadence =
  '{"every":1,"unit":"month","byAcuity":{"High":{"every":2,"unit":"week"}},"overdueAfterDays":7,"postDischarge":{"enabled":true,"every":1,"unit":"week","days":30}}'::jsonb
  WHERE code = 'CCM' AND cadence = '{}'::jsonb;

UPDATE public.care_program_types SET cadence =
  '{"every":3,"unit":"month","byAcuity":{"High":{"every":1,"unit":"month"}},"overdueAfterDays":14,"postDischarge":{"enabled":true,"every":1,"unit":"week","days":30}}'::jsonb
  WHERE code = 'SNP' AND cadence = '{}'::jsonb;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.patient_care_programs DROP COLUMN IF EXISTS cadence_override;
-- ALTER TABLE public.care_program_types DROP COLUMN IF EXISTS cadence;
