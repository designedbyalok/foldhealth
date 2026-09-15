-- Campaign delivery log ──────────────────────────────────────────────────
-- One row per recipient per campaign send. Written by sendCampaignNow() when a
-- campaign is run: the audience is resolved from all_patients, merge tags are
-- substituted per recipient, and a row is logged with a simulated delivery
-- status. The campaigns table's audience/delivered/opened stats are aggregates
-- of these rows. Starts empty; populated by running a campaign (no seed — the
-- data is produced by user action, not a static mock).

create table if not exists public.campaign_sends (
  id              text primary key,          -- `${campaign_id}::${member_id}`
  campaign_id     bigint not null,
  member_id       text,
  recipient_name  text,
  recipient_email text,
  -- sent | delivered | opened | bounced | failed
  status          text not null default 'sent',
  subject         text,
  sent_at         timestamptz,
  opened_at       timestamptz,
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists campaign_sends_campaign_id_idx
  on public.campaign_sends (campaign_id);

-- RLS posture (supabase/RLS_POSTURE.md): on, open to signed-in staff, closed
-- to the anon key.
alter table public.campaign_sends enable row level security;

drop policy if exists "campaign_sends_authenticated_all" on public.campaign_sends;
create policy "campaign_sends_authenticated_all"
  on public.campaign_sends
  for all
  to authenticated
  using (true)
  with check (true);
