-- Email compliance settings (single canonical row) ──────────────────────────
-- Physical mailing address + unsubscribe URL appended to every campaign
-- email's footer (CAN-SPAM) and used for the List-Unsubscribe header. One row,
-- keyed 'default'; the app reads it via fetchEmailComplianceSettings() and
-- falls back to DEFAULT_COMPLIANCE (renderEmail.js) until this runs.

create table if not exists public.email_compliance_settings (
  id               text primary key default 'default',
  clinic_name      text not null default 'Fold Health',
  physical_address text not null default '2261 Market Street #4471, San Francisco, CA 94114',
  -- {{email}} is resolved per-recipient at send time by applyMergeTags.
  unsubscribe_url  text not null default 'https://fold.health/unsubscribe?e={{email}}',
  reply_to         text,
  updated_at       timestamptz not null default now()
);

-- RLS posture (see supabase/RLS_POSTURE.md): on, wide open to signed-in staff,
-- closed to the anon key.
alter table public.email_compliance_settings enable row level security;

drop policy if exists "email_compliance_settings_authenticated_all" on public.email_compliance_settings;
create policy "email_compliance_settings_authenticated_all"
  on public.email_compliance_settings
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.email_compliance_settings (id, clinic_name, physical_address, unsubscribe_url)
values (
  'default',
  'Stanford Care Center',
  '300 Pasteur Drive, Stanford, CA 94305',
  'https://fold.health/unsubscribe?e={{email}}'
)
on conflict (id) do nothing;
