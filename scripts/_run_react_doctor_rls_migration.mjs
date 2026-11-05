// One-off runner for supabase/react_doctor_rls_forward_migration.sql

import { readFileSync } from 'node:fs';
import pg from 'pg';

const envText = readFileSync('/Users/alokk/Foldhealth/.env', 'utf8');
const envLine = (k) =>
  envText.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1)?.trim();

const password = envLine('SUPABASE_DB_PASSWORD');
if (!password) {
  console.error('SUPABASE_DB_PASSWORD missing');
  process.exit(1);
}

const pooler = readFileSync('/Users/alokk/Foldhealth/supabase/.temp/pooler-url', 'utf8').trim();
const url = new URL(pooler);
url.password = password;

const sql = readFileSync(
  '/Users/alokk/Foldhealth/supabase/react_doctor_rls_forward_migration.sql',
  'utf8',
);

const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
console.log(`Connected to ${url.host}${url.pathname}`);

try {
  console.log('Running react-doctor RLS forward migration…\n');
  const t0 = performance.now();
  await client.query(sql);
  console.log(`Migration succeeded in ${(performance.now() - t0).toFixed(0)}ms\n`);

  const policies = await client.query(`
    select tablename, policyname, roles::text, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and tablename in ('forms', 'form_responses', 'audience_segments', 'patient_program_activity')
     order by tablename, policyname
  `);
  console.log('Sample policies (forms + spot-check tables):');
  for (const r of policies.rows) console.log(' ', r);
} catch (e) {
  console.error('MIGRATION FAILED: transaction rolled back.\n', e.message);
  process.exit(1);
} finally {
  await client.end();
}
