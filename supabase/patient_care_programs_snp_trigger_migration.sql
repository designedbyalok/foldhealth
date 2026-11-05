-- SNP enrollment trigger on patient_care_programs.
--
-- Create SNP Program asks which of the member's plan ids the enrollment is
-- for (Member Info, e.g. "HPM316287509 - AMTX"), what triggered it (HRA,
-- Managed by HP, New Member, Reassessment, SCAN Trigger, SFTP Transfer, TOC)
-- and when. The program's Snapshot shows the trigger type and date.
--
-- The client (addCareProgram) saves without these columns until this runs.

begin;

alter table public.patient_care_programs add column if not exists trigger_type text;
alter table public.patient_care_programs add column if not exists trigger_date text;  -- YYYY-MM-DD
alter table public.patient_care_programs add column if not exists member_info  text;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- alter table public.patient_care_programs drop column if exists trigger_type;
-- alter table public.patient_care_programs drop column if exists trigger_date;
-- alter table public.patient_care_programs drop column if exists member_info;
