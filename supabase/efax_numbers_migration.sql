-- Practice eFax numbers (Settings > Messages > eFax).
--
-- Each number has a display name, the fax number itself, the system users
-- (profiles.id) linked to it, and an Active / Inactive status. Linked users
-- are who may send from that number: the Care Gap "Send Referral" eFax
-- sender list shows only active numbers linked to the signed-in user.
--
-- Seed rows are included below (idempotent). They link no users, since
-- links are per real profile; set them in Settings > Messages > eFax.

begin;

create table if not exists public.efax_numbers (
  id               text        primary key,
  name             text        not null,
  number           text        not null,
  linked_user_ids  text[]      not null default '{}',
  is_active        boolean     not null default true,
  created_by       text,
  updated_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One row per fax number (digits only, so formatting can't create duplicates).
create unique index if not exists efax_numbers_number_key
  on public.efax_numbers ((regexp_replace(number, '\D', '', 'g')));
create index if not exists efax_numbers_linked_users_idx
  on public.efax_numbers using gin (linked_user_ids);

alter table public.efax_numbers enable row level security;

drop policy if exists efax_numbers_all on public.efax_numbers;
create policy efax_numbers_all
  on public.efax_numbers for all to authenticated using (true) with check (true);

-- ── Seed ────────────────────────────────────────────────────────────────────
insert into public.efax_numbers (id, name, number, linked_user_ids, is_active) values
  ('efax-1', 'Primary Office',  '(619) 555-1234', '{}', true),
  ('efax-2', 'Care Management', '(619) 555-1288', '{}', true),
  ('efax-3', 'Billing',         '(619) 555-1299', '{}', false)
on conflict (id) do nothing;

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select id, name, number, is_active from public.efax_numbers;   -- expect 3
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop table if exists public.efax_numbers;
