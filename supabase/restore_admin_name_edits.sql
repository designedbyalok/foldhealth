-- Restore four names an admin corrected that the login sync overwrote.
--
-- AppLayout.jsx copied auth.users.raw_user_meta_data (the name typed at
-- sign-up) over profiles on every app load, so an admin's correction lasted
-- only until the user's next login. The code fix stops that; this restores
-- the last admin edit from audit_logs for each affected profile.
--
-- The auth metadata is updated too, so the names hold even on a build that
-- still has the old sync.
--
-- Run: supabase db query --linked --file supabase/restore_admin_name_edits.sql

begin;

create temp table want (email text, full_name text, first_name text, last_name text) on commit drop;
insert into want values
  ('chinmayg@fold.health',        'Chinmay Gumgaonkar', 'Chinmay', 'Gumgaonkar'),
  ('pranalis@fold.health',        'Pranali Shimpi',     'Pranali', 'Shimpi'),
  ('abhaychaudhary907@gmail.com', 'Abhay Chaudhary',    'Abhay',   'Chaudhary'),
  ('ketanp@fold.health',          'Ketan Patni',        'Ketan',   'Patni');

update public.profiles p
   set full_name = w.full_name, first_name = w.first_name, last_name = w.last_name
  from want w
 where p.email = w.email;

update auth.users u
   set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
       || jsonb_build_object('full_name', w.full_name, 'first_name', w.first_name, 'last_name', w.last_name)
  from want w
 where u.email = w.email;

select p.email, p.full_name, u.raw_user_meta_data->>'full_name' as auth_name
  from public.profiles p
  join auth.users u on u.id = p.id
  join want w on w.email = p.email;

commit;
