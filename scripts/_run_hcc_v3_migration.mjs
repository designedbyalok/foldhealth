// One-off runner for supabase/hcc_schema_v3_filter_backing.sql.
// Runs inside its BEGIN … COMMIT so a partial failure rolls back cleanly.

import { readFileSync } from 'node:fs';
import pg from 'pg';

const envText = readFileSync('/Users/alokk/Foldhealth/.env', 'utf8');
const envLine = (k) =>
  envText.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1)?.trim();

const password = envLine('SUPABASE_DB_PASSWORD');
if (!password) { console.error('SUPABASE_DB_PASSWORD missing'); process.exit(1); }

const pooler = readFileSync('/Users/alokk/Foldhealth/supabase/.temp/pooler-url', 'utf8').trim();
const url = new URL(pooler);
url.password = password;

const sql = readFileSync(
  '/Users/alokk/Foldhealth/supabase/hcc_schema_v3_filter_backing.sql',
  'utf8'
);

const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
console.log(`Connected to ${url.host}${url.pathname}`);

try {
  const t0 = performance.now();
  await client.query(sql);
  console.log(`Migration succeeded in ${(performance.now() - t0).toFixed(0)}ms\n`);

  const checks = await client.query(`
    SELECT
      COUNT(*)                          AS members,
      COUNT(city)                       AS with_city,
      COUNT(state)                      AS with_state,
      COUNT(tin)                        AS with_tin,
      COUNT(support_assigned_at)        AS supp_assigned,
      COUNT(support_completed_at)       AS supp_completed,
      COUNT(coder_assigned_at)          AS cdr_assigned,
      COUNT(coder_completed_at)         AS cdr_completed
    FROM hcc_members
  `);
  console.log('Post-migration counts:');
  console.log(checks.rows[0]);

  const sample = await client.query(`
    SELECT id, name, city, state, tin,
           hcc_gap_count, last_gap_activity,
           support_assigned_at, coder_completed_at
      FROM hcc_members_v2
     ORDER BY create_date NULLS LAST
     LIMIT 3
  `);
  console.log('\nSample rows via hcc_members_v2:');
  for (const r of sample.rows) console.log(' ', r);
} catch (e) {
  console.error('MIGRATION FAILED: transaction rolled back.\n', e.message);
  process.exit(1);
} finally {
  await client.end();
}
