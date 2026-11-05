-- Patient consents: allow "other" consents (Data Sharing).
--
-- WHY
-- The Patient Consent popover gains an "Other Consents" section with a
-- Data Sharing Consent (scope_type 'other', scope 'data_sharing'). The
-- original table only allowed 'program' and 'channel', so capturing it
-- would fail the check constraint.
--
-- TCPA is no longer captured (texts and autodialed calls now need the SMS or
-- Call consent itself). Existing TCPA rows are kept as history; nothing is
-- deleted.
--
-- Idempotent: drops and re-adds the scope_type check.
--
-- Ask Alok Kumar to run this migration on Supabase.

begin;

alter table public.patient_consents
  drop constraint if exists patient_consents_scope_type_check;

alter table public.patient_consents
  add constraint patient_consents_scope_type_check
  check (scope_type in ('program', 'channel', 'other'));

commit;
