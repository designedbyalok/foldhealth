-- Templates a care plan recommendation is built from, pending approval.
--
-- A recommendation (enrollment automations matched templates, UnityAI merged
-- them into one plan) writes its goals, interventions and barriers flagged
-- for review, and lists its templates here: [{ id, name, why, automation }].
-- The plan shows them as Recommended. Approving the plan applies them like
-- any template (applied_template_ids, a template run with its version and
-- renewal, the template's conditions) without re-adding the items UnityAI
-- left out, then clears this column; discarding clears it too.
--
-- Additive and idempotent.

ALTER TABLE public.patient_care_plans
  ADD COLUMN IF NOT EXISTS recommended_templates jsonb;

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.patient_care_plans drop column if exists recommended_templates;
