-- Normalise empty-string profile fields to NULL, and stop them coming back.
--
-- THE HOLE THIS CLOSES
-- 30 of 57 profiles are currently **read-only**. Not slow, not partially
-- broken — every UPDATE against them is rejected outright, including a no-op:
--
--   update profiles set updated_at = now() where email = 'abhi@fold.health';
--   ERROR: violates check constraint "profiles_mobile_check"
--
-- A batch of NOT VALID CHECK constraints was added to `profiles`, and a
-- NOT VALID constraint still fires on every INSERT and UPDATE — it only skips
-- the one-time validation scan of existing rows. Three of them reject the
-- empty string:
--
--   profiles_mobile_check    CHECK (mobile   IS NULL OR char_length(mobile) BETWEEN 7 AND 20)
--   profiles_zip_code_check  CHECK (zip_code IS NULL OR zip_code ~ '^\d{5}(-\d{4})?$')
--   profiles_gender_check    CHECK (gender   IS NULL OR gender IN ('Male','Female','Non-binary','Prefer not to say'))
--
-- `''` fails all three (length 0 < 7; no regex match; not in the enum). The
-- other six NOT VALID constraints on the table are `char_length(x) <= n`
-- forms, which `''` satisfies, so they are not implicated.
--
-- USER-VISIBLE CONSEQUENCE
-- Those 30 people cannot save any profile change at all. Preferences → Save
-- fails for them — including the first/last name fix that the
-- `profile.name_incomplete` notification asks them to make. The notification
-- points at a form that cannot succeed.
--
-- WHY THE ROWS LOOK LIKE THIS
-- The client sends `''`, not NULL, for blank fields. PreferencesDrawer's save
-- spreads its whole form state:
--
--   const updates = { full_name: …, ...form };
--
-- and every text field in that form initialises to `''`. So opening
-- Preferences and pressing Save writes an empty string into every field the
-- user left blank. Data alone is therefore not enough to fix — hence the
-- trigger below, which is what stops this recurring.
--
-- SAFETY
-- Verified before writing this: of the 30/30/27 violating rows, **every**
-- violating value is exactly `''`. There are zero non-empty invalid values
-- (no 5-digit mobiles, no malformed zips, no stray gender strings). So
-- `'' -> NULL` cannot destroy a real value — it only replaces "the user typed
-- nothing" with the representation the constraints already expect.
--
--   select count(*) from profiles
--    where (mobile   is not null and mobile   <> '' and not (char_length(mobile) between 7 and 20))
--       or (zip_code is not null and zip_code <> '' and zip_code !~ '^\d{5}(-\d{4})?$')
--       or (gender   is not null and gender   <> '' and gender not in ('Male','Female','Non-binary','Prefer not to say'));
--   -- returns 0

begin;

-- ── 1. Blank-to-NULL on every write ─────────────────────────────────────────
-- The guarantee, below the client. Applies to PreferencesDrawer, the Account
-- panel, the invite flow, the seed script and the SQL editor equally.
--
-- Columns are listed explicitly rather than looped over every text column in
-- the table: `''` is meaningless for these, but blanket-nulling anything
-- text-typed would be a much broader claim than this migration has evidence
-- for.
create or replace function public.blank_profile_fields_to_null()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.middle_name    := nullif(btrim(new.middle_name), '');
  new.bio            := nullif(btrim(new.bio), '');
  new.mobile         := nullif(btrim(new.mobile), '');
  new.fax            := nullif(btrim(new.fax), '');
  new.zip_code       := nullif(btrim(new.zip_code), '');
  new.address_line1  := nullif(btrim(new.address_line1), '');
  new.address_line2  := nullif(btrim(new.address_line2), '');
  new.city           := nullif(btrim(new.city), '');
  new.state          := nullif(btrim(new.state), '');
  new.gender         := nullif(btrim(new.gender), '');
  new.ehr_mapping    := nullif(btrim(new.ehr_mapping), '');
  new.ehr_user       := nullif(btrim(new.ehr_user), '');
  return new;
end;
$$;

revoke all on function public.blank_profile_fields_to_null() from public, anon, authenticated;

-- Ordering matters. Both this and profiles_normalize_name are BEFORE row
-- triggers, and Postgres fires them in alphabetical order by trigger name:
-- `profiles_aa_blank_to_null` sorts before `profiles_normalize_name`, so
-- blanks become NULL first and the name trigger then sees NULL rather than
-- `''` when it decides whether a part is missing. Renaming either breaks
-- that, so the prefix is deliberate.
drop trigger if exists profiles_aa_blank_to_null on public.profiles;
create trigger profiles_aa_blank_to_null
  before insert or update on public.profiles
  for each row execute function public.blank_profile_fields_to_null();

-- ── 2. Backfill the existing rows ───────────────────────────────────────────
-- All the blank columns are nulled in ONE statement on purpose. Nulling them
-- one at a time fails: an UPDATE that fixes `mobile` leaves `zip_code = ''`
-- in the same NEW row, so profiles_zip_code_check rejects the write and the
-- statement aborts. (Confirmed the hard way while fixing two rows by hand.)
--
-- The trigger above would do this anyway, but relying on it would mean
-- issuing a no-op UPDATE per row and hoping — being explicit keeps the
-- migration readable and reviewable.
update public.profiles
   set middle_name   = nullif(btrim(middle_name), ''),
       bio           = nullif(btrim(bio), ''),
       mobile        = nullif(btrim(mobile), ''),
       fax           = nullif(btrim(fax), ''),
       zip_code      = nullif(btrim(zip_code), ''),
       address_line1 = nullif(btrim(address_line1), ''),
       address_line2 = nullif(btrim(address_line2), ''),
       city          = nullif(btrim(city), ''),
       state         = nullif(btrim(state), ''),
       gender        = nullif(btrim(gender), ''),
       ehr_mapping   = nullif(btrim(ehr_mapping), ''),
       ehr_user      = nullif(btrim(ehr_user), '')
 where btrim(coalesce(middle_name,   'x')) = ''
    or btrim(coalesce(bio,           'x')) = ''
    or btrim(coalesce(mobile,        'x')) = ''
    or btrim(coalesce(fax,           'x')) = ''
    or btrim(coalesce(zip_code,      'x')) = ''
    or btrim(coalesce(address_line1, 'x')) = ''
    or btrim(coalesce(address_line2, 'x')) = ''
    or btrim(coalesce(city,          'x')) = ''
    or btrim(coalesce(state,         'x')) = ''
    or btrim(coalesce(gender,        'x')) = ''
    or btrim(coalesce(ehr_mapping,   'x')) = ''
    or btrim(coalesce(ehr_user,      'x')) = '';

-- ── 3. Promote the three constraints ────────────────────────────────────────
-- Safe now that no row holds a blank in these columns, and worth doing: a
-- validated constraint is a fact the planner can rely on, and it stops these
-- rows lingering as a permanent asterisk. If any of these fail, the backfill
-- above did not cover something — read the error, do not weaken the check.
-- Guarded on existence. These three constraints are created by
-- `profiles_field_types_migration.sql`; this file only promotes them. A bare
-- `validate constraint` would make this migration fail outright on any
-- database where that one has not been applied yet — including a fresh one
-- replaying the `supabase/` files in some other order. Skipping is the right
-- behaviour there: nothing to promote means nothing to fix.
do $$
declare
  c text;
begin
  foreach c in array array['profiles_mobile_check','profiles_zip_code_check','profiles_gender_check']
  loop
    if exists (
      select 1 from pg_constraint
       where conrelid = 'public.profiles'::regclass
         and conname = c
         and not convalidated
    ) then
      execute format('alter table public.profiles validate constraint %I', c);
      raise notice 'validated %', c;
    else
      raise notice 'skipped % (absent or already validated)', c;
    end if;
  end loop;
end $$;

-- The other NOT VALID checks on this table (profiles_languages_array and the
-- five char_length forms) already have zero violations and could be promoted
-- in the same breath — deliberately not done here. This migration exists to
-- unfreeze the blank-string rows; promoting constraints it did not fix would
-- make the diff harder to review and the rollback less obvious. Separate
-- concern, separate change.

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- No blanks left in the affected columns:
--   select count(*) from public.profiles
--    where '' in (coalesce(mobile,'x'), coalesce(zip_code,'x'), coalesce(gender,'x'),
--                 coalesce(bio,'x'), coalesce(city,'x'), coalesce(state,'x'),
--                 coalesce(middle_name,'x'), coalesce(fax,'x'),
--                 coalesce(address_line1,'x'), coalesce(address_line2,'x'),
--                 coalesce(ehr_mapping,'x'), coalesce(ehr_user,'x'));
--   Expect: 0
--
-- The 30 rows are writable again — this is the actual point of the migration:
--   update public.profiles set updated_at = now() where email = 'abhi@fold.health';
--   Expect: UPDATE 1  (before this migration: ERROR on profiles_mobile_check)
--
-- The trigger stops blanks coming back, even from a client that still sends
-- them:
--   update public.profiles set mobile = '', zip_code = '', gender = ''
--    where email = 'abhi@fold.health'
--   returning mobile, zip_code, gender;
--   Expect: NULL | NULL | NULL  — accepted, not rejected, because the trigger
--   normalised the blanks before the constraints were evaluated.
--
-- The three implicated constraints promoted:
--   select conname, convalidated from pg_constraint
--    where conrelid='public.profiles'::regclass and contype='c' order by conname;
--   Expect convalidated=true for profiles_mobile_check,
--   profiles_zip_code_check and profiles_gender_check (plus
--   profiles_name_parts_present and profiles_status_check, already validated).
--   The *_length checks and profiles_languages_array stay NOT VALID by
--   choice — see the note in section 3.
--
-- Trigger firing order is what we think it is:
--   select tgname from pg_trigger
--    where tgrelid='public.profiles'::regclass and not tgisinternal order by tgname;
--   Expect profiles_aa_blank_to_null to sort before profiles_normalize_name.
--
-- ── Rollback ────────────────────────────────────────────────────────────────
-- The data change is not usefully reversible (the previous value was `''`,
-- which is what broke the rows) and should not be reverted. To undo the
-- structural parts:
--   drop trigger if exists profiles_aa_blank_to_null on public.profiles;
--   drop function if exists public.blank_profile_fields_to_null();
--   -- and, if you must, re-mark the checks NOT VALID by dropping and
--   -- re-adding them with NOT VALID (there is no ALTER … INVALIDATE).
