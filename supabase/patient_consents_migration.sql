-- Phase 2A.1: patient consent records and contact preferences.
--
-- WHY
-- Consent was two numbers on p360_profiles (consent_given / consent_total,
-- "2/4") with no record of who consented to what, when, how, or with what
-- signature, and nothing stopped billable work without it. This adds:
--
--   patient_consents     Append-only consent history. One row per capture,
--                        per patient and scope; the newest row for a scope is
--                        its current state. A withdrawal is a new row, never
--                        an update, so the history doubles as the audit log.
--                        Insert and select only: no update or delete policy.
--   patient_preferences  One row per patient: channel per program, language
--                        and interpreter, health literacy, contact validity.
--   patient-consents     PRIVATE storage bucket for signed artifacts (drawn
--                        signature PNG or uploaded scan). Read through signed
--                        URLs, never public links, because these are PHI.
--
-- SCOPES
--   scope_type 'program': CCM, APCM, RPM, BHI (billable programs that need
--                         documented patient consent before billing)
--   scope_type 'channel': call, sms, email, tcpa (autodialed / prerecorded
--                         calls and texts)
--
-- patient_consents columns
--   id text PK, patient_id, scope_type, scope, status (given | declined |
--   withdrawn), method (verbal | written | e_sign; null for a decline),
--   captured_by, captured_by_role, captured_at, effective_on, expires_on
--   (null = no expiry), witness (verbal consent), artifact_path (object path
--   in patient-consents), artifact_kind (signature | upload), note,
--   program_id (patient_care_programs.id it was captured for, optional).
--
-- patient_preferences columns
--   patient_id PK, channel_by_program jsonb {"CCM":"call","RPM":"sms"},
--   preferred_language, needs_interpreter, health_literacy (adequate |
--   limited | unknown), contact_points jsonb
--   [{"kind":"phone"|"email","value":"…","status":"valid"|"invalid"|"unverified","checked_at":"ISO","note":"…"}],
--   updated_by, updated_at.
--
-- Additive and idempotent. RLS: signed-in staff only (see RLS_POSTURE.md).
-- The app keeps working without this migration (consent reads as missing,
-- preferences stay session-only). Seed: patient_consents_seed.sql.
-- Ask Alok Kumar to run this migration, then the seed, on Supabase.

begin;

create table if not exists public.patient_consents (
  id                text        primary key,
  patient_id        text        not null,
  scope_type        text        not null check (scope_type in ('program', 'channel')),
  scope             text        not null,
  status            text        not null check (status in ('given', 'declined', 'withdrawn')),
  method            text        check (method in ('verbal', 'written', 'e_sign')),
  captured_by       text,
  captured_by_role  text,
  captured_at       timestamptz not null default now(),
  effective_on      date,
  expires_on        date,
  witness           text,
  artifact_path     text,
  artifact_kind     text        check (artifact_kind in ('signature', 'upload')),
  note              text,
  program_id        text,
  constraint patient_consents_given_has_method check (status <> 'given' or method is not null)
);

create index if not exists patient_consents_patient_scope_idx
  on public.patient_consents (patient_id, scope_type, scope, captured_at desc);

alter table public.patient_consents enable row level security;

drop policy if exists patient_consents_select on public.patient_consents;
create policy patient_consents_select on public.patient_consents
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists patient_consents_insert on public.patient_consents;
create policy patient_consents_insert on public.patient_consents
  for insert to authenticated
  with check ((select auth.uid()) is not null);

create table if not exists public.patient_preferences (
  patient_id          text        primary key,
  channel_by_program  jsonb       not null default '{}'::jsonb,
  preferred_language  text,
  needs_interpreter   boolean     not null default false,
  health_literacy     text        not null default 'unknown'
                                  check (health_literacy in ('adequate', 'limited', 'unknown')),
  contact_points      jsonb       not null default '[]'::jsonb,
  updated_by          text,
  updated_at          timestamptz not null default now()
);

alter table public.patient_preferences enable row level security;

drop policy if exists patient_preferences_all on public.patient_preferences;
create policy patient_preferences_all on public.patient_preferences
  for all to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

-- Private: signed artifacts are PHI. No update or delete policy, so a stored
-- artifact can't be overwritten or removed from the app.
insert into storage.buckets (id, name, public, file_size_limit)
values ('patient-consents', 'patient-consents', false, 10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "patient-consents upload" on storage.objects;
create policy "patient-consents upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'patient-consents');

drop policy if exists "patient-consents read" on storage.objects;
create policy "patient-consents read" on storage.objects
  for select to authenticated
  using (bucket_id = 'patient-consents');

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop table if exists public.patient_consents;
--   drop table if exists public.patient_preferences;
--   drop policy if exists "patient-consents upload" on storage.objects;
--   drop policy if exists "patient-consents read" on storage.objects;
--   delete from storage.buckets where id = 'patient-consents';  -- only when empty
