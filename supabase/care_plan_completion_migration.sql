-- Care plan Complete, then the provider signs (care plan redesign prototype).
--
-- The care manager completes the plan: records that the patient agreed to it,
-- whether the patient asked for a copy (channel, language, large print), and
-- the provider who signs it. The plan then reads "Awaiting signature" until
-- that provider signs, which cuts the version exactly as Sign does today
-- (signed_by / signed_at). Editing the plan after completing it puts it back
-- to "needs completing", so a provider never signs what changed since.
--
-- A copy request is only recorded: nothing is sent from the app yet.
-- Completing writes a care_plan_audit row (entity_type 'plan', action
-- 'completed') and a "Sign care plan" task for the provider.
--
-- Additive and idempotent. No new table, so RLS is unchanged.

ALTER TABLE public.patient_care_plans
  ADD COLUMN IF NOT EXISTS completed_by           text,
  ADD COLUMN IF NOT EXISTS completed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS awaiting_signer        text,
  ADD COLUMN IF NOT EXISTS awaiting_signer_id     text,
  ADD COLUMN IF NOT EXISTS patient_agreed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS patient_agreement_note text,
  -- { channel: 'Portal'|'Mail'|'SMS Link', language: text|null, largePrint: bool }
  ADD COLUMN IF NOT EXISTS copy_request           jsonb;

COMMENT ON COLUMN public.patient_care_plans.completed_at IS
  'When the care manager completed the plan and sent it to awaiting_signer. Awaiting while signed_at is null or earlier.';
COMMENT ON COLUMN public.patient_care_plans.copy_request IS
  'The patient copy asked for at completion: { channel, language, largePrint }. Recorded only; nothing is sent.';
