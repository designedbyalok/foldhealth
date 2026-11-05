// Preflight check for supabase/hcc_schema_v2_types_and_normalization.sql
// Confirms every row's text values will convert cleanly to the new types.
// Read-only: makes no changes.

import { readFileSync } from 'node:fs';
import pg from 'pg';

const envText = readFileSync('/Users/alokk/Foldhealth/.env', 'utf8');
const envLine = (key) =>
  envText.split('\n').find(l => l.startsWith(key + '='))?.slice(key.length + 1)?.trim();

const password = envLine('SUPABASE_DB_PASSWORD');
if (!password) { console.error('SUPABASE_DB_PASSWORD missing'); process.exit(1); }

const pooler = readFileSync('/Users/alokk/Foldhealth/supabase/.temp/pooler-url', 'utf8').trim();
const url = new URL(pooler);
url.password = password;

const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
console.log(`Connected to ${url.host}${url.pathname}\n`);

const checks = [
  {
    label: 'hcc_members.age, must match /(\\d+y)?\\s*(\\d+m)?/ and be non-empty',
    sql: `
      SELECT id, name, age FROM hcc_members
       WHERE age IS NULL
          OR age !~ '(\\d+\\s*y)|(\\d+\\s*m)'
    `,
  },
  {
    label: "hcc_members.create_date, must be parseable as MM/DD/YYYY",
    sql: `
      SELECT id, name, create_date FROM hcc_members
       WHERE create_date IS NOT NULL
         AND create_date !~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
    `,
  },
  {
    label: 'hcc_members.raf_score, must parse as numeric',
    sql: `
      SELECT id, name, raf_score FROM hcc_members
       WHERE raf_score IS NOT NULL AND raf_score <> ''
         AND raf_score !~ '^-?\\d+(\\.\\d+)?$'
    `,
  },
  {
    label: 'hcc_members.raf_impact, must parse as numeric',
    sql: `
      SELECT id, name, raf_impact FROM hcc_members
       WHERE raf_impact IS NOT NULL AND raf_impact <> ''
         AND raf_impact !~ '^-?\\d+(\\.\\d+)?$'
    `,
  },
  {
    label: 'hcc_members.decile, must parse as integer',
    sql: `
      SELECT id, name, decile FROM hcc_members
       WHERE decile IS NOT NULL AND decile <> ''
         AND decile !~ '^-?\\d+$'
    `,
  },
  {
    label: 'hcc_members.advillness, must parse as integer',
    sql: `
      SELECT id, name, advillness FROM hcc_members
       WHERE advillness IS NOT NULL AND advillness <> ''
         AND advillness !~ '^-?\\d+$'
    `,
  },
  {
    label: 'hcc_members.frailty, must parse as integer',
    sql: `
      SELECT id, name, frailty FROM hcc_members
       WHERE frailty IS NOT NULL AND frailty <> ''
         AND frailty !~ '^-?\\d+$'
    `,
  },
  {
    label: 'hcc_diagnosis_gaps.last_activity, must be MM/DD/YYYY or NULL',
    sql: `
      SELECT id, member_name, last_activity FROM hcc_diagnosis_gaps
       WHERE last_activity IS NOT NULL AND last_activity <> ''
         AND last_activity !~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
    `,
  },
  {
    label: 'hcc_members.dos_list, entries with unparseable date field',
    sql: `
      SELECT m.id, m.name, elem->>'date' AS bad_date
        FROM hcc_members m
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.dos_list, '[]'::jsonb)) AS elem
       WHERE elem->>'date' IS NOT NULL
         AND elem->>'date' !~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
    `,
  },
];

let anyIssues = false;
for (const check of checks) {
  const { rows } = await client.query(check.sql);
  if (rows.length === 0) {
    console.log(`  ok: ${check.label}`);
  } else {
    anyIssues = true;
    console.log(`\n  BAD: ${check.label}`);
    console.log(`         ${rows.length} row(s) will fail conversion:`);
    for (const r of rows.slice(0, 20)) {
      console.log('         ', r);
    }
    if (rows.length > 20) console.log(`         … +${rows.length - 20} more`);
    console.log();
  }
}

// Row counts for context
const counts = await client.query(`
  SELECT
    (SELECT COUNT(*) FROM hcc_members)                    AS members,
    (SELECT COUNT(*) FROM hcc_diagnosis_gaps)             AS gaps,
    (SELECT SUM(jsonb_array_length(COALESCE(dos_list, '[]'::jsonb)))
       FROM hcc_members)                                  AS dos_entries,
    (SELECT SUM(jsonb_array_length(COALESCE(doc_status, '[]'::jsonb)))
       FROM hcc_members)                                  AS doc_entries
`);
console.log('\nRow counts:', counts.rows[0]);

// Also flag if hcc_members_v2 view already exists (idempotent path)
const viewCheck = await client.query(`
  SELECT COUNT(*) AS n FROM information_schema.views
   WHERE table_name = 'hcc_members_v2'
`);
console.log('hcc_members_v2 view already exists:', viewCheck.rows[0].n > 0);

await client.end();
process.exit(anyIssues ? 1 : 0);
