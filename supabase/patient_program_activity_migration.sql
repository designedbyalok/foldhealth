-- Program Activity Log — per-patient activity entries across every care
-- program. The UI groups these by date, then by program, into collapsible
-- cards (Care Management → Program Activity Log).
create table if not exists patient_program_activity (
  id            uuid primary key default gen_random_uuid(),
  patient_id    text not null,
  program_code  text not null,           -- SNP | TOC | AWV | HIU | CCM …
  program_name  text not null,           -- e.g. "SNP Program Updates"
  occurred_at   timestamptz not null,
  actor_name    text not null default '',
  actor_initials text not null default '',
  title         text not null,
  status_label  text not null default '',
  status_type   text not null default 'neutral', -- success | warning | error | neutral
  activity_kind text not null default 'document', -- document | call | clipboard | letter | sms | email | status
  created_at    timestamptz not null default now()
);

alter table patient_program_activity enable row level security;

drop policy if exists "Allow all patient_program_activity" on patient_program_activity;
create policy "Allow all patient_program_activity" on patient_program_activity
  for all using (true) with check (true);

create index if not exists idx_ppa_patient_time
  on patient_program_activity (patient_id, occurred_at desc);
