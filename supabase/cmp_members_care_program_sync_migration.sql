-- CMP worklist members as care program enrollments.
--
-- The CMP worklist reads cmp_members (one row per sub-program: SPD, Maternity
-- Program, ...), while a patient's Care Programs tab reads
-- patient_care_programs. Nothing joined the two, so a CMP member opened from
-- anywhere but the worklist's View action showed "No Active Programs".
--
-- This backfills one CMP enrollment per cmp_members row that has a patient and
-- a sub-program, using the roster's start date, due date and assignee. Ids
-- match the app's (pcp-<patient>-CMP-<sub-program slug>). The app keeps new
-- roster rows in sync from here on (syncCmpEnrollments in useAppStore.js).
--
-- Needs patient_care_programs_sub_program_migration.sql and
-- patient_care_program_lifecycle_migration.sql first (sub_program, instance,
-- planned_end_date). Safe to re-run: existing enrollments are left alone.

begin;

insert into public.patient_care_programs
  (id, patient_id, code, sub_program, instance, name, acuity, status, status_color,
   start_date, end_date, last_updated, assignee, pcp, progress, planned_end_date)
select
  'pcp-' || m.patient_id || '-CMP-' || regexp_replace(lower(m.sub_program), '[^a-z0-9]+', '-', 'g'),
  m.patient_id,
  'CMP',
  m.sub_program,
  1,
  m.sub_program || ' (CMP)',
  null,
  'New',
  'var(--primary-300)',
  coalesce(nullif(m.program_start_date, ''), to_char(now(), 'MM/DD/YYYY')),
  '-',
  to_char(now(), 'MM/DD/YYYY'),
  coalesce(nullif(m.assignee, ''), 'Unassigned'),
  '-',
  0,
  nullif(m.program_due_date, '')
from public.cmp_members m
where m.patient_id is not null and m.patient_id <> ''
  and m.sub_program is not null and m.sub_program <> ''
  and not exists (
    select 1 from public.patient_care_programs p
    where p.patient_id = m.patient_id and p.code = 'CMP' and p.sub_program = m.sub_program
  )
on conflict do nothing;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   delete from public.patient_care_programs p
--   using public.cmp_members m
--   where p.patient_id = m.patient_id and p.code = 'CMP' and p.sub_program = m.sub_program
--     and p.id = 'pcp-' || m.patient_id || '-CMP-' || regexp_replace(lower(m.sub_program), '[^a-z0-9]+', '-', 'g');
