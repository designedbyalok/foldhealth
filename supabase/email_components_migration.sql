-- Components (Settings -> Content -> Components): saved headers and footers
-- live in email_header_footer_presets. This adds what the Components list
-- and the report print header need:
--   is_default  one default component per role (the app clears the others)
--   slug        a stable key for seeded components, e.g. 'report-print-header'
--   updated_at  kept current on every update (the "Last Updated" column)

create sequence if not exists public.email_header_footer_presets_id_seq;

create table if not exists public.email_header_footer_presets (
  "id" bigint default nextval('email_header_footer_presets_id_seq'::regclass) primary key,
  "role" text not null,
  "name" text not null,
  "description" text,
  "accent" text default '#7C5CFA'::text,
  "tree" jsonb not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

alter table public.email_header_footer_presets add column if not exists "is_default" boolean not null default false;
alter table public.email_header_footer_presets add column if not exists "slug" text;
create unique index if not exists email_header_footer_presets_slug_key on public.email_header_footer_presets (slug);

create or replace function public.email_header_footer_presets_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists email_header_footer_presets_touch on public.email_header_footer_presets;
create trigger email_header_footer_presets_touch
  before update on public.email_header_footer_presets
  for each row execute function public.email_header_footer_presets_touch();

-- RLS and its access policy already exist on this table (see
-- aaa_bootstrap_missing_tables_migration.sql and
-- narrow_public_batch1_reference.sql); left as they are.
