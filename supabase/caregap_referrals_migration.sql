-- HEDIS Care Gap referrals: the "Send Referral" workspace in the Care Gap
-- Details drawer. A referral can go out by eFax, Email, SMS or Chat.
--
--   "Refer to" recipients are the practice's system users (profiles:
--   fax / mobile / email columns; chat reaches any active user). No
--   separate provider directory.
--   referral_sender_lines: the practice's own eFax numbers / email
--                            addresses / SMS numbers ("Select Your eFax
--                            Number" etc.). Chat needs no sender line.
--   caregap_referrals: every referral sent from a care gap. The
--                            Referrals tab lists these; each send is also
--                            logged to caregap_activity by the app.
--
-- Seed rows for referral_sender_lines are included below (idempotent).
-- caregap_referrals has no seed: rows accrue as users send referrals.
--
-- NOTE: rows record the referral and its channel. Delivery through a real
-- fax / email / SMS provider is not wired yet; status stays 'Sent'.

begin;

-- ── Sender lines ───────────────────────────────────────────────────────────
create table if not exists public.referral_sender_lines (
  id          text primary key,
  channel     text not null check (channel in ('efax', 'email', 'sms')),
  label       text not null,
  value       text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Sent referrals ──────────────────────────────────────────────────────────
create table if not exists public.caregap_referrals (
  id              text        primary key,
  hedis_member_id text        not null,
  member_name     text,
  gap_code        text,
  channel         text        not null check (channel in ('efax', 'email', 'sms', 'chat')),
  sender_line_id  text,
  sender_value    text,
  provider_id     text,        -- profiles.id of the recipient
  provider_name   text        not null,
  provider_contact text,
  reason          text        not null,
  note            text,
  attachments     jsonb       not null default '[]'::jsonb,
  status          text        not null default 'Sent',
  sent_by         text,
  created_at      timestamptz not null default now()
);

create index if not exists caregap_referrals_member_idx
  on public.caregap_referrals (hedis_member_id, created_at desc);

-- ── RLS: signed-in staff (same practice-wide model as caregap_activity) ─────
alter table public.referral_sender_lines enable row level security;
alter table public.caregap_referrals enable row level security;

drop policy if exists referral_sender_lines_read on public.referral_sender_lines;
create policy referral_sender_lines_read
  on public.referral_sender_lines for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists caregap_referrals_all on public.caregap_referrals;
create policy caregap_referrals_all
  on public.caregap_referrals for all to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

-- ── Seed: sender lines ──────────────────────────────────────────────────────
insert into public.referral_sender_lines (id, channel, label, value, is_default) values
  ('rs-efax-1',  'efax',  'Primary Office',   '(619) 555-1234',            true),
  ('rs-efax-2',  'efax',  'Care Management',  '(619) 555-1288',            false),
  ('rs-email-1', 'email', 'Referrals Desk',   'referrals@fold.example',    true),
  ('rs-email-2', 'email', 'Care Management',  'caremgmt@fold.example',     false),
  ('rs-sms-1',   'sms',   'Primary Office',   '(619) 555-1200',            true)
on conflict (id) do nothing;

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select count(*) from public.referral_sender_lines;   -- expect 5
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop table if exists public.caregap_referrals;
--   drop table if exists public.referral_sender_lines;
