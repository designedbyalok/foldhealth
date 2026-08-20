-- Require a capitalised first_name and last_name on every profile.
--
-- THE HOLE THIS CLOSES
-- 27 of 57 profiles fail the rule. 25 of them have a correct `full_name` and
-- NULL first/last, which is not a coincidence — it is a single missing write.
--
-- `handle_new_user()` (profiles_signup_role_defaults.sql) inserts:
--
--   INSERT INTO public.profiles (id, email, full_name, status, role, ...)
--
-- It *builds* full_name by concatenating the metadata first/last, and then
-- never stores either part. So every account created through the signup
-- trigger lands with first_name/last_name NULL, whatever the identity
-- provider supplied. Google and other OAuth providers send only a full name,
-- so nothing downstream could recover the split either.
--
-- The client had the mirror-image bug: AppLayout's profile sync derived
-- full_name FROM first/last but never the reverse, so a later login refreshed
-- the row without ever filling the gap.
--
-- WHAT THIS DOES
--   1. `public.profile_name_parts(text)` — the canonical split: first
--      whitespace-delimited token is the first name, the remainder is the last
--      name. Mirrors `splitFullName()` in src/lib/nameValidation.js exactly;
--      if you change one, change the other.
--   2. A BEFORE INSERT OR UPDATE trigger on `profiles` that fills missing
--      name parts from full_name and capitalises both. This is the guarantee:
--      it applies to the signup trigger, the SQL editor, the seed script and
--      any future client equally, which client-side validation cannot.
--   3. Rewrites `handle_new_user()` to insert first_name/last_name so new
--      signups are correct at the source rather than relying on the trigger
--      above to repair them.
--   4. Backfills the 25 derivable rows.
--   5. Adds a CHECK constraint as NOT VALID (see the note on that below).
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- No guessing where there is nothing to guess from. Two profiles have no name
-- anywhere (`devanshis@fold.health`, `thewildricks@outlook.com`) and two have
-- a lowercase or junk surname that a human should confirm rather than have
-- machine-capitalised into something wrong (`ketanp@fold.health` -> "patni",
-- `sunnyb+22june@fold.health` -> "22june"). Those get a notification asking
-- them to fix it, which is why the constraint is NOT VALID.
--
-- WHY THE CONSTRAINT IS `NOT VALID`
-- A plain CHECK would be validated against every existing row and abort this
-- migration while those four remain non-compliant. NOT VALID enforces the rule
-- on every INSERT and UPDATE from now on while tolerating the known
-- stragglers. Once they are fixed, promote it with:
--   alter table public.profiles validate constraint profiles_name_parts_present;

begin;

-- ── 1. Canonical split ──────────────────────────────────────────────────────
create or replace function public.profile_name_parts(full_name text)
returns record
language sql
immutable
set search_path = public
as $$
  select
    (regexp_split_to_array(btrim(coalesce(full_name, '')), '\s+'))[1] as first_name,
    nullif(
      array_to_string(
        (regexp_split_to_array(btrim(coalesce(full_name, '')), '\s+'))[2:],
        ' '
      ), ''
    ) as last_name;
$$;

revoke all on function public.profile_name_parts(text) from public, anon, authenticated;

-- ── 2. Fill + capitalise on every write ─────────────────────────────────────
create or replace function public.normalize_profile_name()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parts record;
begin
  -- Derive only what is missing. A caller that supplied a real first/last
  -- keeps it — this repairs gaps, it does not overrule the client.
  if nullif(btrim(coalesce(new.first_name, '')), '') is null
     or nullif(btrim(coalesce(new.last_name, '')), '') is null then
    select * into parts from public.profile_name_parts(new.full_name)
      as t(first_name text, last_name text);
    if nullif(btrim(coalesce(new.first_name, '')), '') is null then
      new.first_name := parts.first_name;
    end if;
    if nullif(btrim(coalesce(new.last_name, '')), '') is null then
      new.last_name := parts.last_name;
    end if;
  end if;

  -- Capitalise the leading character of whatever we ended up with. `initcap`
  -- is deliberately avoided: it would lowercase the rest and turn "McDonald"
  -- into "Mcdonald" and "van der Berg" into "Van Der Berg".
  if nullif(btrim(coalesce(new.first_name, '')), '') is not null then
    new.first_name := btrim(new.first_name);
    new.first_name := upper(left(new.first_name, 1)) || substr(new.first_name, 2);
  end if;
  if nullif(btrim(coalesce(new.last_name, '')), '') is not null then
    new.last_name := btrim(new.last_name);
    new.last_name := upper(left(new.last_name, 1)) || substr(new.last_name, 2);
  end if;

  -- Keep full_name consistent with the parts when it is the empty one.
  if nullif(btrim(coalesce(new.full_name, '')), '') is null
     and new.first_name is not null then
    new.full_name := btrim(concat_ws(' ', new.first_name, new.last_name));
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_profile_name() from public, anon, authenticated;

drop trigger if exists profiles_normalize_name on public.profiles;
create trigger profiles_normalize_name
  before insert or update on public.profiles
  for each row execute function public.normalize_profile_name();

-- ── 3. Fix the source: store the parts at signup ────────────────────────────
-- Same body as profiles_signup_role_defaults.sql, with first_name/last_name
-- added to the column list. role/admin_role stay hardcoded to the
-- non-privileged defaults — they must never be client-supplied.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, first_name, last_name,
    status, role, admin_role, created_at, last_active_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NULLIF(TRIM(
        COALESCE(NEW.raw_user_meta_data->>'first_name', '') ||
        ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
      ), '')
    ),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'invited' = 'true' THEN 'Invited'
      ELSE 'Active'
    END,
    'Viewer',     -- never inherit a privileged default
    'Employer',   -- non-administrative
    NEW.created_at,
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ── 4. Backfill what is derivable ───────────────────────────────────────────
-- A no-op UPDATE is enough: the trigger above does the derive + capitalise.
-- Restricted to rows that actually have something to derive from, so the two
-- nameless profiles are left alone rather than written with empty strings.
update public.profiles
   set updated_at = now()
 where nullif(btrim(coalesce(full_name, '')), '') is not null
   and (
     nullif(btrim(coalesce(first_name, '')), '') is null
     or nullif(btrim(coalesce(last_name, '')), '') is null
     or first_name <> upper(left(btrim(first_name), 1)) || substr(btrim(first_name), 2)
     or last_name  <> upper(left(btrim(last_name), 1))  || substr(btrim(last_name), 2)
   );

-- ── 5. Enforce going forward ────────────────────────────────────────────────
alter table public.profiles
  drop constraint if exists profiles_name_parts_present;

alter table public.profiles
  add constraint profiles_name_parts_present
  check (
    nullif(btrim(coalesce(first_name, '')), '') is not null
    and nullif(btrim(coalesce(last_name,  '')), '') is not null
    and first_name ~ '^[[:upper:]]'
    and last_name  ~ '^[[:upper:]]'
  )
  not valid;

-- ── 6. Ask the remaining users to fix their own name ────────────────────────
-- Addressed to whoever STILL fails after the backfill, computed rather than
-- hardcoded — so this stays correct if the data shifts before it is run, and
-- notifies nobody if the backfill happened to resolve everything.
--
-- Guarded by NOT EXISTS on (recipient, type) so re-running the migration does
-- not stack duplicate nags. `notifications` has no INSERT policy for clients
-- by design; this runs as the migration role, which is not subject to RLS.
insert into public.notifications
  (recipient_id, actor_id, actor_name, type, title, body, action)
select p.id, null, 'Fold', 'profile.name_incomplete',
       'Add your first and last name',
       case
         when nullif(btrim(coalesce(p.full_name, '')), '') is null
           then 'We could not find a name on your profile. Add your first and last name so teammates can identify you.'
         else 'Your last name needs a capital letter. Open Preferences to correct it.'
       end,
       'openProfileName'
  from public.profiles p
 where (
         nullif(btrim(coalesce(p.first_name, '')), '') is null
         or nullif(btrim(coalesce(p.last_name, '')), '') is null
         or p.first_name !~ '^[[:upper:]]'
         or p.last_name  !~ '^[[:upper:]]'
       )
   and not exists (
     select 1 from public.notifications n
      where n.recipient_id = p.id
        and n.type = 'profile.name_incomplete'
   );

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Backfill landed and only the known stragglers remain:
--   select email, first_name, last_name, full_name from public.profiles
--    where first_name is null or last_name is null
--       or first_name !~ '^[[:upper:]]' or last_name !~ '^[[:upper:]]'
--    order by email;
--   Expect exactly: devanshis@fold.health, thewildricks@outlook.com
--   (the two with no name to derive). ketanp@ and sunnyb+22june@ should now
--   read "Patni" and "22june" -> the trigger capitalises the leading char, so
--   "22june" stays "22june" (a digit has no uppercase form) and still fails
--   the constraint — which is correct, it needs a human.
--
-- Split convention matches the client:
--   select * from public.profile_name_parts('Abhay Pratap Chaudhary')
--     as t(first_name text, last_name text);
--   Expect: Abhay | Pratap Chaudhary
--
-- The trigger repairs a partial write:
--   insert into public.profiles (id, email, full_name)
--   values (gen_random_uuid(), 'trigger-probe@example.com', 'ada lovelace')
--   returning first_name, last_name, full_name;
--   Expect: Ada | Lovelace | ada lovelace
--   (full_name is left as given — only the parts are normalised.)
--   Then: delete from public.profiles where email = 'trigger-probe@example.com';
--
-- The constraint rejects a bad write:
--   update public.profiles set last_name = 'patni'
--    where email = 'ketanp@fold.health';
--   Expect: ERROR ... violates check constraint "profiles_name_parts_present"
--   (the trigger capitalises first, so this actually succeeds as "Patni" —
--    to see the constraint bite, try last_name = '' instead.)
--
-- Signup now stores the parts:
--   select tgname from pg_trigger where tgrelid='auth.users'::regclass
--    and not tgisinternal;  -- handle_new_user still attached
--
-- Once the stragglers are fixed, promote the constraint:
--   alter table public.profiles validate constraint profiles_name_parts_present;
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   alter table public.profiles drop constraint if exists profiles_name_parts_present;
--   drop trigger if exists profiles_normalize_name on public.profiles;
--   drop function if exists public.normalize_profile_name();
--   drop function if exists public.profile_name_parts(text);
--   -- restore handle_new_user() from profiles_signup_role_defaults.sql
