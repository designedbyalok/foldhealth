// Reset HCC role assignments and clear activity history.
//
// Usage: from the repo root:
//   bun run scripts/_reset_hcc_roles.mjs        (or: node scripts/_reset_hcc_roles.mjs)
//
// Requirements:
//   - SUPABASE_DB_PASSWORD in .env
//   - supabase/.temp/pooler-url populated by `supabase link`
//
// What it does: inside a single BEGIN/COMMIT:
//   - probes which of the referenced tables exist (some envs never ran the
//     hcc_activity_log migration and its siblings, and a missing table would
//     abort the whole transaction),
//   - snapshots BEFORE counts,
//   - nulls every assignee (support_name / coder_name / reviewer1_name /
//     reviewer2_name) on hcc_members and resets each *_status to 'Assign',
//   - deletes every row from the activity tables that DO exist,
//   - snapshots AFTER counts.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const envText = readFileSync('.env', 'utf8');
const envLine = (key) => envText.split('\n').find(l => l.startsWith(key + '='))?.slice(key.length + 1)?.trim();
const password = envLine('SUPABASE_DB_PASSWORD');
if (!password) { console.error('SUPABASE_DB_PASSWORD missing from .env'); process.exit(1); }

const pooler = readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
const url = new URL(pooler);
url.password = password;

const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
console.log(`Connected to ${url.host}${url.pathname} as ${url.username}\n`);

const ACTIVITY_TABLES = [
  'hcc_activity_log',
  'hcc_diag_history',
  'hcc_gap_activity',
  'hcc_gap_dos_actions',
];

const { rows: existing } = await client.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = ANY($1)`,
  [['hcc_members', ...ACTIVITY_TABLES]]
);
const have = new Set(existing.map(r => r.table_name));
if (!have.has('hcc_members')) {
  console.error('hcc_members not found: nothing to reset.');
  await client.end();
  process.exit(1);
}
const presentActivity = ACTIVITY_TABLES.filter(t => have.has(t));
const skipped = ACTIVITY_TABLES.filter(t => !have.has(t));

console.log('Tables present :', ['hcc_members', ...presentActivity].join(', '));
if (skipped.length) console.log('Tables skipped :', skipped.join(', '), '(do not exist in this DB)');

const countLines = presentActivity.map(t => `,\n       (SELECT count(*) FROM ${t}) AS ${t}_rows`).join('');
const beforeSelect = `
SELECT 'BEFORE' AS phase,
       (SELECT count(*) FROM hcc_members) AS hcc_members_total,
       (SELECT count(*) FROM hcc_members
          WHERE support_name IS NOT NULL OR coder_name IS NOT NULL
             OR reviewer1_name IS NOT NULL OR reviewer2_name IS NOT NULL) AS members_with_any_assignee${countLines};`;
const afterSelect = beforeSelect.replace("'BEFORE'", "'AFTER'");
const deletes = presentActivity.map(t => `DELETE FROM ${t};`).join('\n');

const finalSql = `
BEGIN;
${beforeSelect}
UPDATE hcc_members
   SET support_name = NULL, support_status = 'Assign',
       coder_name = NULL, coder_status = 'Assign',
       reviewer1_name = NULL, reviewer1_status = 'Assign',
       reviewer2_name = NULL, reviewer2_status = 'Assign';
${deletes}
${afterSelect}
COMMIT;
`;

console.log(`\nExecuting ${finalSql.length} chars of SQL…\n`);
const result = await client.query(finalSql);
const results = Array.isArray(result) ? result : [result];
for (const r of results) {
  if (r?.command === 'SELECT' && r.rows?.length) {
    console.log('SELECT:');
    console.table(r.rows);
  } else if (r?.command && r.rowCount != null) {
    console.log(`${r.command}: ${r.rowCount} rows`);
  }
}

await client.end();
console.log('\nDone.');
