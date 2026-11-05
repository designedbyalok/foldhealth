// One-off runner for supabase/hcc_schema_v2_types_and_normalization.sql.
// The SQL is transactional (BEGIN … COMMIT) so a failure rolls back cleanly.

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
  '/Users/alokk/Foldhealth/supabase/hcc_schema_v2_types_and_normalization.sql',
  'utf8'
);

const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
console.log(`Connected to ${url.host}${url.pathname}`);

try {
  console.log('Running migration…\n');
  const t0 = performance.now();
  await client.query(sql);
  console.log(`Migration succeeded in ${(performance.now() - t0).toFixed(0)}ms\n`);

  // Post-migration sanity check
  const checks = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM hcc_members)                                             AS members,
      (SELECT COUNT(date_of_birth) FROM hcc_members)                                 AS with_dob,
      (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'hcc_members' AND column_name IN ('age', 'dos_list', 'doc_status')) AS legacy_cols_remaining,
      (SELECT COUNT(*) FROM hcc_member_visits)                                       AS visits,
      (SELECT COUNT(*) FROM hcc_member_documents)                                    AS docs,
      (SELECT COUNT(*) FROM information_schema.views
        WHERE table_name = 'hcc_members_v2')                                         AS view_exists,
      (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'hcc_members' AND column_name = 'create_date')            AS create_date_type,
      (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'hcc_members' AND column_name = 'raf_score')              AS raf_score_type,
      (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'hcc_members' AND column_name = 'decile')                 AS decile_type
  `);
  console.log('Post-migration verification:');
  console.log(checks.rows[0]);

  // View sanity: fetch one row through it
  const sample = await client.query(`
    SELECT id, name, date_of_birth, create_date, raf_score, decile,
           jsonb_array_length(dos_list) AS dos_ct,
           jsonb_array_length(doc_status) AS doc_ct
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
