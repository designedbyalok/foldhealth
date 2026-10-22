#!/usr/bin/env node
// Seed auth.users + auth.identities for admin profiles on the dev Supabase
// project, so devs can sign in to dev with their real email addresses.
//
// `scripts/dev-db-sync.sh` copies production's `public` schema into dev but
// leaves `auth.*` empty (it's a Supabase-managed schema that pg_dump cannot
// touch). After a fresh sync the admin profiles are orphaned: profiles.id
// references auth.users.id, but no auth.users row exists. This script fills
// in the gap for every admin profile.
//
// Idempotent: skips any profile that already has a matching auth.users row.
// Hard-refuses to run if the target isn't the Foldhealth Dev project.
//
// All admins share the same password, VITE_DEV_LOGIN_PASSWORD from .env
// (the value demo@fold.health already uses). No new secret to manage.
//
// Usage:  node scripts/seed-dev-admins.mjs
// Needs:  .env:                   VITE_DEV_LOGIN_PASSWORD
//         .env.development.local: DEV_SUPABASE_PROJECT_REF,
//                                 DEV_SUPABASE_DB_PASSWORD

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pg = require('pg');

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEV_REF   = 'uwswpbiyhlmpnubxtipc';
const DEV_HOST  = 'aws-0-ap-southeast-1.pooler.supabase.com';

function readEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n').filter(Boolean)
      .filter((l) => !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

const dev  = readEnv(join(REPO_ROOT, '.env.development.local'));
const main = readEnv(join(REPO_ROOT, '.env'));

if (dev.DEV_SUPABASE_PROJECT_REF !== DEV_REF) {
  console.error(`Refusing: DEV_SUPABASE_PROJECT_REF is "${dev.DEV_SUPABASE_PROJECT_REF ?? '(unset)'}", expected "${DEV_REF}".`);
  console.error('See docs/getting-started/dev-database.mdx for setup.');
  process.exit(1);
}
if (!dev.DEV_SUPABASE_DB_PASSWORD) {
  console.error('DEV_SUPABASE_DB_PASSWORD missing from .env.development.local');
  process.exit(1);
}
if (!main.VITE_DEV_LOGIN_PASSWORD) {
  console.error('VITE_DEV_LOGIN_PASSWORD missing from .env');
  process.exit(1);
}

const conn = `postgresql://postgres.${DEV_REF}:${encodeURIComponent(dev.DEV_SUPABASE_DB_PASSWORD)}@${DEV_HOST}:5432/postgres`;
const c = new pg.Client({ connectionString: conn });
await c.connect();

const missing = (await c.query(`
  select p.id, p.email, p.first_name, p.last_name, p.admin_role
    from public.profiles p
    left join auth.users u on u.id = p.id
   where p.admin_role in ('Business/Practice Owner','Admin/Practice Manager')
     and u.id is null
   order by p.email
`)).rows;

if (missing.length === 0) {
  console.log('All admin profiles already have auth.users rows. Nothing to do.');
  await c.end();
  process.exit(0);
}

console.log(`Creating auth.users for ${missing.length} admin profile(s):`);
for (const r of missing) console.log(`  ${r.email}  (${r.first_name} ${r.last_name}, ${r.admin_role})`);
console.log();

for (const p of missing) {
  await c.query('begin');
  try {
    await c.query(
      `insert into auth.users (
         instance_id, id, aud, role, email,
         encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data,
         created_at, updated_at,
         is_sso_user, is_anonymous
       ) values (
         '00000000-0000-0000-0000-000000000000'::uuid,
         $1, 'authenticated', 'authenticated', $2,
         extensions.crypt($3, extensions.gen_salt('bf', 10)),
         now(),
         jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
         jsonb_build_object('full_name', $4::text),
         now(), now(),
         false, false
       )`,
      [p.id, p.email, main.VITE_DEV_LOGIN_PASSWORD, `${p.first_name || ''} ${p.last_name || ''}`.trim()]
    );
    await c.query(
      `insert into auth.identities (
         provider_id, user_id, identity_data, provider,
         created_at, updated_at
       ) values (
         $1::text, $2::uuid,
         jsonb_build_object('sub', $1::text, 'email', $3::text, 'email_verified', true, 'phone_verified', false),
         'email', now(), now()
       )`,
      [p.id, p.id, p.email]
    );
    await c.query('commit');
    console.log(`  created ${p.email}`);
  } catch (e) {
    await c.query('rollback');
    console.log(`  FAILED ${p.email}: ${e.message}`);
  }
}

console.log('\nVerification:');
console.table((await c.query(`
  select p.email, p.first_name, p.admin_role,
         (u.id is not null) as has_auth,
         (i.user_id is not null) as has_identity,
         u.email_confirmed_at::date as confirmed_on
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join auth.identities i on i.user_id = p.id and i.provider = 'email'
   where p.admin_role in ('Business/Practice Owner','Admin/Practice Manager')
   order by p.email
`)).rows);

await c.end();
console.log('\nShared password: VITE_DEV_LOGIN_PASSWORD (same as demo@fold.health).');
