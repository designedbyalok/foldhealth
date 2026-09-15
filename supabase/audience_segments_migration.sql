-- Campaign audience segments ───────────────────────────────────────────────
-- The selectable audiences in the CampaignBuilder Include/Exclude pickers.
-- Each row's `id` is stored in campaigns.audience_include / audience_exclude,
-- and `resolver_key` maps to a predicate in
-- src/features/campaign/audienceResolver.js that filters all_patients. The
-- store falls back to a built-in list until this table is populated.
--
-- Segments are chosen to resolve against the real all_patients data (age,
-- location, chronic_conditions), so the count each produces is a real subset.

create table if not exists public.audience_segments (
  id           text primary key,   -- stored in campaigns.audience_include/exclude
  label        text not null,
  resolver_key text not null,      -- predicate key in audienceResolver.js
  sort_order   int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.audience_segments enable row level security;

drop policy if exists "audience_segments_authenticated_all" on public.audience_segments;
create policy "audience_segments_authenticated_all"
  on public.audience_segments
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.audience_segments (id, label, resolver_key, sort_order) values
  ('all-patients', 'All Patients',        'all',       0),
  ('diabetic',     'Diabetic',            'diabetic',  1),
  ('cardiac',      'Cardiac / Heart',     'cardiac',   2),
  ('seniors',      'Seniors (65+)',       'seniors',   3),
  ('pediatric',    'Pediatric (under 18)', 'pediatric', 4),
  ('nj-patients',  'New Jersey patients', 'nj',        5),
  ('ny-patients',  'New York patients',   'ny',        6)
on conflict (id) do nothing;
