-- CMP sub-programs on patient_care_programs.
--
-- CMP (Care Management Program) is enrolled per sub-program: SPD, Whole Child
-- Model, Basic Case Management, Complex Case Management, Coordination of Care,
-- Maternity Program, Pediatrics Program. A member can hold one enrollment of
-- each, so the one-row-per-(patient_id, code) key widens to
-- (patient_id, code, sub_program). Every other program keeps sub_program = ''
-- and so still allows one row per code.
--
-- The client (addCareProgram) upserts on the new key and falls back to the
-- old one, so it works before and after this runs.

begin;

alter table public.patient_care_programs
  add column if not exists sub_program text not null default '';

alter table public.patient_care_programs
  drop constraint if exists patient_care_programs_patient_id_code_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patient_care_programs_patient_id_code_sub_program_key'
      and conrelid = 'public.patient_care_programs'::regclass
  ) then
    alter table public.patient_care_programs
      add constraint patient_care_programs_patient_id_code_sub_program_key
      unique (patient_id, code, sub_program);
  end if;
end $$;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- Only safe while no patient has two rows with the same code.
-- begin;
-- alter table public.patient_care_programs
--   drop constraint if exists patient_care_programs_patient_id_code_sub_program_key;
-- alter table public.patient_care_programs
--   add constraint patient_care_programs_patient_id_code_key unique (patient_id, code);
-- alter table public.patient_care_programs drop column if exists sub_program;
-- commit;
