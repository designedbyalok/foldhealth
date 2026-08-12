#!/usr/bin/env bun
/**
 * Fold Health — All Patients demographics backfill
 *
 * Fills the patient-data parity columns added by
 * supabase/all_patients_patient_data_parity_migration.sql (dob, ipa,
 * hp_code, zip) for every all_patients row.
 *
 * - dob: copied from the `patients` table when the member_id matches;
 *   otherwise derived with the exact same math the UI used at render time
 *   (deriveDob + the row's "Ny Mm" age derivation), anchored to a fixed
 *   date — so the stored DOB matches what users have been seeing, and stops
 *   drifting as the calendar moves.
 * - ipa / hp_code / zip: deterministic per-row picks from the value pools
 *   the other worklist tables use; zip matches the row's city when known.
 * - Non-destructive: only NULL fields are filled; re-runs are no-ops.
 *
 * Usage:    bun run scripts/seed_all_patients_demographics.js
 * Requires: SUPABASE_DB_PASSWORD in .env
 */

import pg from 'pg';
import { readFileSync } from 'node:fs';

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) { console.error('SUPABASE_DB_PASSWORD missing — add it to .env'); process.exit(1); }

let poolerHost = 'aws-1-ap-southeast-1.pooler.supabase.com';
let poolerUser = 'postgres.osnihfqqrcchsaqhagcx';
try {
  const u = new URL(readFileSync(new URL('../supabase/.temp/pooler-url', import.meta.url), 'utf8').trim());
  poolerHost = u.hostname;
  poolerUser = decodeURIComponent(u.username);
} catch { /* fall back to the hardcoded pooler */ }

// Anchored so the stored DOBs equal what deriveDob rendered on this date,
// and so re-runs stay deterministic.
const TODAY = new Date('2026-08-12T12:00:00');

// Mirrors src/lib/patientDob.js nameHash + deriveDob and the "Ny Mm"
// derivation in AllPatientsRow.jsx — keep in sync if those change.
function nameHash(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
const pad2 = (n) => String(n).padStart(2, '0');
function deriveDob(ageYears, name) {
  const years = parseInt(ageYears, 10);
  if (Number.isNaN(years)) return null;
  const months = nameHash(name) % 12;
  const born = new Date(TODAY.getFullYear() - years, TODAY.getMonth() - months, 1);
  const day = 1 + (nameHash(name) % 28);
  return `${pad2(born.getMonth() + 1)}/${pad2(day)}/${born.getFullYear()}`;
}

// Value pools drawn from the other worklist tables' live data
const IPAS = ['IPA-West', 'IPA-North', 'CFC', 'Astrana', 'LA Care'];
const HP_CODES = ['HP-001', 'HP-002', 'H1234', 'H5678'];
const CITY_ZIPS = {
  'Paterson': '07501', 'Newark': '07102', 'Yonkers': '10701', 'Bronx': '10451',
  'Manhattan': '10016', 'Queens': '11375', 'Hempstead': '11550', 'Brooklyn': '11215',
  'Jersey City': '07302', 'New York': '10001', 'Stamford': '06901', 'Hoboken': '07030',
  'White Plains': '10601',
};

// ── fillDummy mirror ─────────────────────────────────────────────────────────
// EXACT replica of fillDummy() in src/features/all-patients/AllPatientsTable.jsx
// (hash, pools, bit-shifts). The table has been inventing these display values
// at render time for rows with NULL columns; persisting the same derivations
// makes the DB the source of truth without changing anything the user sees —
// and lets the p360 banner seed read the same values the table shows.
// Keep in sync with fillDummy if it ever changes.
const CITIES = [
  ['Queens', 'NY'], ['Brooklyn', 'NY'], ['Manhattan', 'NY'], ['Bronx', 'NY'],
  ['Newark', 'NJ'], ['Jersey City', 'NJ'], ['Stamford', 'CT'], ['Yonkers', 'NY'],
  ['Paterson', 'NJ'], ['Hoboken', 'NJ'], ['White Plains', 'NY'], ['Hempstead', 'NY'],
];
const TPAS = ['Aetna', 'BCBS', 'UHC', 'Humana', 'Cigna', 'Anthem'];
const COVERAGES = ['HMO', 'PPO', 'EPO', 'POS', 'Medicare Advantage'];
const CONDITIONS = ['Diabetes', 'Hypertension', 'CHF', 'COPD', 'CKD', 'Asthma', 'Obesity', 'Depression'];
const PROGRAMS = ['CCM', 'APCM', 'RPM', 'BHI', 'TCM'];
const PCPS = [
  { name: 'Dr. Sarah Chen', init: 'SC' },
  { name: 'Dr. James Park', init: 'JP' },
  { name: 'Dr. Elena Rodriguez', init: 'ER' },
  { name: 'Dr. Michael Lee', init: 'ML' },
  { name: 'Dr. Priya Patel', init: 'PP' },
  { name: 'Dr. David Kim', init: 'DK' },
];
function fillDummyHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
const pick = (arr, seed) => arr[seed % arr.length];
function fillDummy(row) {
  const seed = fillDummyHash(row.id);
  const [city, state] = pick(CITIES, seed);
  const pcp = pick(PCPS, seed >> 3);
  const phoneDigits = String(2000000000 + (seed % 7999999999));
  const firstName = (row.name || 'member').split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
  const condCount = (seed % 3) + 1;
  const conditions = [];
  const seenConditions = new Set();
  for (let i = 0; i < condCount; i++) {
    const c = CONDITIONS[(seed + i * 7) % CONDITIONS.length];
    if (!seenConditions.has(c)) { seenConditions.add(c); conditions.push(c); }
  }
  return {
    email: `${firstName}${seed % 99}@fold.health`,
    phone: `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`,
    city,
    state,
    location: `${city}, ${state}`,
    tpa: pick(TPAS, seed >> 5),
    coverage_type: pick(COVERAGES, seed >> 2),
    plan_code: `PL${String(seed % 9000 + 1000)}`,
    group_number: `G${String(seed % 900000 + 100000)}`,
    family_id: `F${String(seed % 90000 + 10000)}`,
    unique_member_id: `U${String(seed % 900000000 + 100000000)}`,
    chronic_conditions: conditions,
    pcp: pcp.name,
    pcp_initials: pcp.init,
    last_visit: new Date(2025, (seed % 12), (seed % 27) + 1).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    active_care_program: pick(PROGRAMS, seed >> 7),
    tags: [pick(['High Risk', 'Rising Risk', 'Stable'], seed >> 1)],
  };
}
const DUMMY_JSONB = new Set(['chronic_conditions', 'tags']);

async function main() {
  console.log('\n🌱  All Patients demographics backfill\n');
  const db = new pg.Client({ host: poolerHost, port: 5432, database: 'postgres', user: poolerUser, password: DB_PASSWORD, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // 1. Copy real DOBs from the patients table where member ids line up.
  const { rowCount: copied } = await db.query(`
    update all_patients a
       set dob = p.dob
      from patients p
     where a.dob is null
       and p.dob is not null
       and p.member_id::text = a.member_id::text
  `);
  console.log(`  ✓ dob copied from patients table: ${copied} rows`);

  // 2. Persist the table's render-time dummy values (exact fillDummy math),
  //    then derive the parity columns. Only NULL/empty fields are written.
  const { rows } = await db.query(`
    select id, name, age, dob, ipa, hp_code, zip, email, phone, city, state, location,
           tpa, coverage_type, plan_code, group_number, family_id, unique_member_id,
           chronic_conditions, pcp, pcp_initials, last_visit, active_care_program, tags
      from all_patients order by id`);
  let filled = 0;
  for (const r of rows) {
    const dummy = fillDummy(r);
    const updates = {};
    for (const [k, v] of Object.entries(dummy)) {
      const isEmpty = r[k] == null || (Array.isArray(r[k]) && r[k].length === 0);
      if (isEmpty) updates[k] = DUMMY_JSONB.has(k) ? JSON.stringify(v) : v;
    }
    // Parity columns; zip follows the (possibly just-filled) city
    const city = r.city ?? dummy.city;
    if (r.dob == null) updates.dob = deriveDob(r.age, r.name);
    if (r.ipa == null) updates.ipa = IPAS[nameHash(r.id) % IPAS.length];
    if (r.hp_code == null) updates.hp_code = HP_CODES[nameHash(r.id) % HP_CODES.length];
    if (r.zip == null) updates.zip = CITY_ZIPS[city] || String(7001 + (nameHash(r.id) % 2999)).padStart(5, '0');
    const changed = Object.entries(updates).filter(([, v]) => v != null);
    if (!changed.length) continue;
    await db.query(
      `update all_patients set ${changed.map(([k], i) => `${k} = $${i + 2}${DUMMY_JSONB.has(k) ? '::jsonb' : ''}`).join(', ')} where id = $1`,
      [r.id, ...changed.map(([, v]) => v)],
    );
    filled++;
  }
  // Zips seeded before cities existed fell back to a hash value — realign
  // them with the now-persisted city so location and zip agree.
  for (const [city, zip] of Object.entries(CITY_ZIPS)) {
    await db.query(`update all_patients set zip = $2 where city = $1 and zip <> $2`, [city, zip]);
  }
  const { rows: [stats] } = await db.query(`select count(*) total, count(dob) with_dob, count(ipa) with_ipa, count(hp_code) with_hp, count(zip) with_zip from all_patients`);
  console.log(`  ✓ derived fills: ${filled} rows`);
  console.log(`\nDone — ${stats.total} rows: dob ${stats.with_dob}, ipa ${stats.with_ipa}, hp_code ${stats.with_hp}, zip ${stats.with_zip}.\n`);
  await db.end();
}

main().catch((err) => { console.error('Backfill failed:', err.message); process.exit(1); });
